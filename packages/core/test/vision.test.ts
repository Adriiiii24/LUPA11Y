/** Las tareas de visión con un doble del modelo: sin red, sin navegador. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Part } from '@google/genai';
import type { z } from 'zod';
import {
  applyNodePatches,
  classifyGeminiError,
  GeminiAsker,
  judgeAltTexts,
  limiter,
  openVisionSession,
  proposePatches,
  type GenerateContent,
  type ImageSample,
  type VisionAsker,
  type VisionOptions,
} from '../src/phases/vision.ts';
import { z as zod } from 'zod';
import { makeFinding } from './helpers/fixtures.ts';

/** Un error como los que lanza el SDK de Google: estado HTTP y el cuerpo JSON de la API. */
const googleError = (code: number, status: string, details: unknown[] = []) =>
  Object.assign(new Error(JSON.stringify({ error: { code, message: 'You exceeded your current quota.', status, details } })), { name: 'ApiError', status: code });

const perMinute = (seconds: string) =>
  googleError(429, 'RESOURCE_EXHAUSTED', [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier', quotaValue: '10' }] },
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: seconds },
  ]);

const perDay = () =>
  googleError(429, 'RESOURCE_EXHAUSTED', [
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '250' }] },
  ]);

const Answer = zod.object({ ok: zod.boolean() });

function asker(script: Array<Error | 'ok'>, extra: Partial<VisionOptions> = {}) {
  const logs: string[] = [];
  let active = 0;
  let peak = 0;
  let calls = 0;
  const generate: GenerateContent = async () => {
    const step = script[Math.min(calls, script.length - 1)];
    calls += 1;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    if (step instanceof Error) throw step;
    return { text: '{"ok":true}' };
  };
  const options: VisionOptions = {
    apiKey: 'clave-de-prueba',
    model: 'gemini-de-prueba',
    maxCalls: 20,
    level: 'AA',
    signal: new AbortController().signal,
    log: (message) => logs.push(message),
    throttledRpm: 60_000,
    ...extra,
  };
  const client = new GeminiAsker(options, generate);
  return { client, logs, stats: () => ({ calls, peak }) };
}

describe('cliente de Gemini con la cuota del plan gratuito', () => {
  it('clasifica los errores de Google: clave, modelo, cuota diaria y límite por minuto con su espera', () => {
    assert.equal(classifyGeminiError(googleError(400, 'INVALID_ARGUMENT', [{ reason: 'API_KEY_INVALID' }])).kind, 'auth');
    assert.equal(classifyGeminiError(googleError(404, 'NOT_FOUND')).kind, 'model');
    assert.equal(classifyGeminiError(perDay()).kind, 'daily');
    assert.deepEqual(classifyGeminiError(perMinute('23.4s')), { kind: 'rate', message: perMinute('23.4s').message, retryAfterMs: 23_400, limit: 10 });
    assert.equal((classifyGeminiError(perDay()) as { limit: number | null }).limit, 250);
    assert.equal(classifyGeminiError(new Error('socket hang up')).kind, 'other');
  });

  it('ante el límite por minuto espera lo que pide Google, sigue de una en una y reintenta', async () => {
    const { client, logs, stats } = asker([perMinute('0.05s'), perMinute('0.05s'), 'ok']);
    const results = await Promise.all([1, 2, 3, 4].map(() => client.ask(Answer, [{ text: 'hola' }])));
    assert.ok(results.every((r) => r?.ok === true), 'todas acaban respondiendo');
    assert.equal(logs.filter((l) => l.includes('pide esperar')).length, 1, 'el aviso sale una vez');
    assert.ok(stats().calls >= 6);
  });

  it('con un ritmo fijado no hay dos consultas en vuelo', async () => {
    const { client, stats } = asker(['ok'], { rpm: 60_000 });
    await Promise.all([1, 2, 3, 4, 5].map(() => client.ask(Answer, [{ text: 'hola' }])));
    assert.equal(stats().peak, 1);
  });

  it('con la cuota diaria agotada, el modelo inexistente o la clave inválida se detiene a la primera', async () => {
    for (const [error, text] of [
      [perDay(), 'cuota diaria'],
      [googleError(404, 'NOT_FOUND'), 'gemini-de-prueba'],
      [googleError(403, 'PERMISSION_DENIED'), 'clave'],
    ] as const) {
      const { client, logs, stats } = asker([error]);
      assert.equal(await client.ask(Answer, [{ text: 'a' }]), null);
      assert.equal(await client.ask(Answer, [{ text: 'b' }]), null);
      assert.equal(stats().calls, 1, 'no vuelve a llamar');
      assert.ok(logs.some((l) => l.includes(text)), logs.join(' | '));
    }
  });

  it('ante un modelo saturado (503) reintenta con esperas crecientes', async () => {
    const busy = googleError(503, 'UNAVAILABLE');
    const { client, logs, stats } = asker([busy, busy, 'ok'], { busyBackoffMs: 1 });
    const result = await client.ask(Answer, [{ text: 'a' }]);
    assert.equal(result?.ok, true);
    assert.equal(stats().calls, 3);
    assert.equal(logs.filter((l) => l.includes('saturado')).length, 1, 'el aviso sale una vez');
    assert.deepEqual(client.models, ['gemini-de-prueba']);
  });

  it('si el principal sigue saturado, continúa con el modelo de reserva y lo dice', async () => {
    const logs: string[] = [];
    const generate: GenerateContent = async (request) => {
      if (request.model === 'gemini-de-prueba') throw googleError(503, 'UNAVAILABLE');
      return { text: '{"ok":true}' };
    };
    const client = new GeminiAsker(
      {
        apiKey: 'x',
        model: 'gemini-de-prueba',
        fallbackModel: 'gemini-de-reserva',
        busyBackoffMs: 1,
        maxCalls: 10,
        level: 'AA',
        signal: new AbortController().signal,
        log: (message) => logs.push(message),
      },
      generate,
    );
    const results = await Promise.all([1, 2, 3].map(() => client.ask(Answer, [{ text: 'a' }])));
    assert.ok(results.every((r) => r?.ok === true));
    assert.deepEqual(client.models, ['gemini-de-reserva']);
    assert.ok(logs.some((l) => l.includes('continúa con «gemini-de-reserva»')));
  });

  it('si el principal agota su cuota diaria, sigue con el de reserva (la cuota gratuita es por modelo)', async () => {
    const logs: string[] = [];
    let primary = 0;
    const generate: GenerateContent = async (request) => {
      if (request.model === 'gemini-de-prueba') {
        primary += 1;
        throw perDay();
      }
      return { text: '{"ok":true}' };
    };
    const client = new GeminiAsker(
      { apiKey: 'x', model: 'gemini-de-prueba', fallbackModel: 'gemini-de-reserva', maxCalls: 10, level: 'AA', signal: new AbortController().signal, log: (m) => logs.push(m) },
      generate,
    );
    for (let i = 0; i < 3; i += 1) assert.equal((await client.ask(Answer, [{ text: 'a' }]))?.ok, true);
    assert.equal(primary, 1, 'no insiste con el modelo agotado');
    assert.ok(logs.some((l) => l.includes('ha agotado su cuota diaria (250 consultas al día en este plan)') && l.includes('gemini-de-reserva')), logs.join(' | '));
    assert.equal(classifyGeminiError(perDay()).kind, 'daily');
  });

  it('cuenta aparte el tiempo esperando la cuota, sin duplicarlo con esperas en paralelo', async () => {
    const { client } = asker([perMinute('0.2s'), perMinute('0.2s'), perMinute('0.2s'), 'ok']);
    await Promise.all([1, 2, 3].map(() => client.ask(Answer, [{ text: 'a' }])));
    const waited = client.waitedMs;
    assert.ok(waited >= 180, `esperó ${waited} ms`);
    assert.ok(waited < 450, `tres esperas simultáneas de 200 ms no suman 600: ${waited} ms`);
  });

  it('nunca espera más allá del tiempo que le queda a la auditoría', async () => {
    const { client, logs } = asker([perMinute('30s')], { deadline: Date.now() + 1_000 });
    const started = Date.now();
    assert.equal(await client.ask(Answer, [{ text: 'a' }]), null);
    assert.ok(Date.now() - started < 1_000, 'no se quedó esperando');
    assert.ok(logs.some((l) => l.includes('ya no hay tiempo')));
  });
});

const session = (answer: (text: string) => unknown) => {
  const client: VisionAsker & { calls: number } = {
    calls: 0,
    async ask<T>(_schema: z.ZodType<T>, parts: Part[]) {
      this.calls += 1;
      return answer(parts.map((p) => p.text ?? '').join('\n')) as T;
    },
  };
  return openVisionSession({ apiKey: '', model: 'doble', maxCalls: 10, level: 'AA', signal: new AbortController().signal, log: () => undefined }, client);
};

const image = (alt: string | null, selector: string): ImageSample => ({
  selector,
  alt,
  src: `/${selector}.jpg`,
  rect: { x: 0, y: 0, width: 100, height: 100 },
  inLink: true,
  context: '',
  html: `<img src="/${selector}.jpg" alt="${alt ?? ''}">`,
  image: Buffer.from('jpeg'),
});

describe('visión', () => {
  it('un alt vacío en una imagen decorativa es lo correcto; uno descriptivo, no', async () => {
    const result = await judgeAltTexts(session(() => ({ verdict: 'decorative', suggestedAlt: '', rationale: 'Adorno.', confidence: 0.9 })), {
      images: [image('', 'logo'), image('Ramas de cafeto', 'adorno')],
      pageTitle: 'Tienda',
      axeFindings: [],
    });
    assert.deepEqual(result.findings.map((f) => [f.id, f.nodes.map((n) => n.selector)]), [['vision:alt-decorative', ['adorno']]]);
  });

  it('propone el alt de una imagen sin alt como arreglo del hallazgo de axe, sin tocar el hallazgo', async () => {
    const missing = makeFinding('axe:image-alt', 'critical', [{ selector: 'img.hero', html: '<img src="/hero.jpg">' }]);
    missing.nodes[0]!.rect = { x: 0, y: 0, width: 100, height: 100 };
    const result = await judgeAltTexts(session(() => ({ verdict: 'accurate', suggestedAlt: 'Bolsa de café', rationale: 'Producto.', confidence: 0.9 })), {
      images: [image(null, 'hero')],
      pageTitle: 'Tienda',
      axeFindings: [missing],
    });
    assert.equal(result.patches.length, 1);
    assert.equal(missing.nodes[0]?.fix, null, 'las tareas no mutan los hallazgos de otras fases');
    const [patched] = applyNodePatches([missing], result.patches);
    assert.match(patched?.nodes[0]?.fix?.after ?? '', /alt="Bolsa de café"/);
    assert.equal(patched?.nodes[0]?.fix?.origin, 'model');
  });

  it('solo acepta un parche que conserva la etiqueta de apertura', async () => {
    const button = makeFinding('axe:button-name', 'critical', [
      { selector: '.cart', html: '<button class="cart"></button>' },
      { selector: '.menu', html: '<button class="menu"></button>' },
    ]);
    const patches = await proposePatches(
      session(() => ({
        patches: [
          { id: '0', html: '<button class="cart" aria-label="Ver carrito"></button>', summary: 'Da nombre al botón.' },
          { id: '1', html: '<div class="menu">Menú</div>', summary: 'Lo cambia todo.' },
        ],
      })),
      [button],
    );
    assert.deepEqual(patches.map((p) => p.nodeIndex), [0]);
  });

  it('el limitador nunca deja pasar más tareas de las permitidas', async () => {
    const run = limiter(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
      });
    await Promise.all(Array.from({ length: 9 }, task));
    assert.equal(peak, 2);
  });
});

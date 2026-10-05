/**
 * Extremo a extremo contra la demo rota a propósito (apps/web/public/demo).
 * Cada fallo sembrado debe aparecer; si la demo o el motor cambian, este test lo dice.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import type { Part } from '@google/genai';
import type { z } from 'zod';
import { audit, AuditError, Report, type AuditEvent, type VisionAsker } from '../src/index.ts';
import { setAttribute } from '../src/fixes/html.ts';
import { serveDirectory } from './helpers/static-server.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../../../apps/web/public', import.meta.url));

/** Doble del modelo: responde según la tarea que reconoce en el prompt. */
class ScriptedAsker implements VisionAsker {
  calls = 0;
  async ask<T>(_schema: z.ZodType<T>, parts: Part[]): Promise<T | null> {
    this.calls += 1;
    const text = parts.map((part) => part.text ?? '').join('\n');
    if (text.includes('texto alternativo')) {
      if (text.includes('IMG_0231')) return { verdict: 'wrong', suggestedAlt: 'Taza de café humeante sobre su plato', rationale: 'Es un nombre de archivo.', confidence: 0.95 } as T;
      if (text.includes('(la imagen no tiene atributo alt)')) return { verdict: 'accurate', suggestedAlt: 'Bolsa de café Etiopía Guji de Tostadero Norte', rationale: 'Producto principal.', confidence: 0.9 } as T;
      if (text.includes('Ramas de cafeto')) return { verdict: 'decorative', suggestedAlt: '', rationale: 'Adorno sin información.', confidence: 0.8 } as T;
      return { verdict: 'accurate', suggestedAlt: '', rationale: 'Correcto.', confidence: 0.9 } as T;
    }
    if (text.includes('Imagen A')) return { perceivable: false, rationale: 'Contorno de 1 px casi del color del fondo.', confidence: 0.85 } as T;
    if (text.includes('fragmento HTML corregido')) {
      const cases = [...text.matchAll(/id: (\d+)\n[^]*?html: <dato>([^]*?)<\/dato>/g)];
      return {
        patches: cases
          .filter(([, , html]) => html?.startsWith('<button'))
          .map(([, id, html]) => ({ id: id ?? '', html: setAttribute(html ?? '', 'aria-label', 'Ver carrito'), summary: 'Da nombre al botón.' })),
      } as T;
    }
    return null;
  }
}

describe('auditoría de la demo', () => {
  let server: Awaited<ReturnType<typeof serveDirectory>>;
  let report: Report;
  const events: AuditEvent[] = [];
  const asker = new ScriptedAsker();

  before(async () => {
    server = await serveDirectory(PUBLIC_DIR);
    report = await audit(`${server.origin}/demo/index.html`, { vision: { client: asker, model: 'doble-de-test' }, onEvent: (e) => events.push(e) });
  });
  after(() => server.close());

  const rules = () => new Set(report.findings.map((f) => f.id));

  it('cumple el contrato Zod y emite el resultado', () => {
    assert.equal(Report.safeParse(report).success, true);
    assert.equal(events.at(-1)?.type, 'result');
    assert.deepEqual(
      report.phases.map((p) => [p.id, p.status]),
      [
        ['load', 'done'],
        ['axe', 'done'],
        ['layout', 'done'],
        ['keyboard', 'done'],
        ['vision', 'done'],
      ],
    );
  });

  it('emite la captura y los hallazgos de cada fase antes del resultado, sin imágenes', () => {
    const types = events.map((e) => e.type);
    const capture = types.indexOf('capture');
    assert.ok(capture > -1 && capture < types.indexOf('partial'), 'la captura llega antes que los parciales');
    const partials = events.filter((e): e is Extract<AuditEvent, { type: 'partial' }> => e.type === 'partial');
    assert.deepEqual(
      partials.map((p) => p.phase),
      ['axe', 'layout', 'keyboard'],
    );
    assert.ok(partials.every((p) => p.findings.every((f) => f.nodes.every((n) => n.evidence.crop === null && n.evidence.focused === null))));
    assert.equal(partials.at(-1)?.keyboard?.outcome, 'trap');
  });

  it('consulta al modelo en paralelo con el agente de teclado', () => {
    const running = (phase: string) => events.findIndex((e) => e.type === 'phase' && e.phase === phase && e.state === 'running');
    const keyboardDone = events.findIndex((e) => e.type === 'phase' && e.phase === 'keyboard' && e.state === 'done');
    assert.ok(running('vision') > -1 && running('vision') < running('keyboard'), 'la visión arranca antes que el teclado');
    assert.ok(keyboardDone < events.findIndex((e) => e.type === 'phase' && e.phase === 'vision' && e.state === 'done'));
  });

  it('mide el reflujo a 320 px y el espaciado de texto de WCAG 1.4.12', () => {
    const reflow = report.findings.find((f) => f.id === 'layout:reflow');
    assert.equal(reflow?.severity, 'high');
    assert.ok(reflow?.nodes.some((n) => n.selector === 'header'), 'la cabecera no se adapta');
    assert.ok(reflow?.nodes.every((n) => n.fix?.origin === 'deterministic' && n.fix.diff.includes('@media (max-width: 40rem)')));
    const spacing = report.findings.find((f) => f.id === 'layout:text-spacing');
    assert.deepEqual(
      spacing?.nodes.map((n) => n.selector),
      ['span.sello'],
    );
    assert.match(spacing?.nodes[0]?.fix?.after ?? '', /white-space: normal;/);
    assert.match(spacing?.nodes[0]?.evidence.crop ?? '', /^data:image\/png;base64,/);
  });

  it('lee el rol y el nombre del árbol de accesibilidad de Chromium', () => {
    const stops = report.keyboard?.stops ?? [];
    const cart = stops.find((s) => s.selector === 'button.cart');
    assert.deepEqual([cart?.role, cart?.name], ['button', '']);
    const search = stops.find((s) => s.selector === 'input.search');
    assert.deepEqual([search?.role, search?.name], ['searchbox', 'Buscar cafés']);
    const add = stops.find((s) => s.selector.endsWith('div.add'));
    assert.deepEqual([add?.role, add?.name], ['button', 'Añadir']);
  });

  it('encuentra los fallos deterministas de axe', () => {
    for (const id of ['axe:button-name', 'axe:image-alt', 'axe:color-contrast', 'axe:html-has-lang']) assert.ok(rules().has(id), id);
    const contrast = report.findings.find((f) => f.id === 'axe:color-contrast');
    assert.ok(contrast?.nodes.every((n) => n.fix?.origin === 'deterministic' && n.fix.diff.includes('+  color: #')));
  });

  it('recorre el teclado y detecta la trampa, el foco invisible, el tapado y los botones falsos', () => {
    assert.equal(report.keyboard?.outcome, 'trap');
    assert.equal(report.keyboard?.loop.length, 2);
    assert.equal(report.findings.find((f) => f.id === 'keyboard:keyboard-trap')?.severity, 'critical');
    const invisible = report.findings.find((f) => f.id === 'keyboard:focus-invisible');
    assert.deepEqual(
      invisible?.nodes.map((n) => n.selector),
      ['nav > a:nth-of-type(1)', 'nav > a:nth-of-type(2)', 'nav > a:nth-of-type(3)', 'nav > a:nth-of-type(4)'],
    );
    assert.equal(report.findings.find((f) => f.id === 'keyboard:focus-obscured')?.occurrences, 4);
    const inoperable = report.findings.find((f) => f.id === 'keyboard:keyboard-inoperable');
    assert.equal(inoperable?.occurrences, 3);
    assert.match(inoperable?.nodes[0]?.fix?.after ?? '', /^<button type="button" class="add">Añadir<\/button>$/);
  });

  it('usa la visión para lo que las reglas no deciden', () => {
    const missing = report.findings.find((f) => f.id === 'axe:image-alt')?.nodes[0];
    assert.equal(missing?.fix?.origin, 'model');
    assert.match(missing?.fix?.after ?? '', /alt="Bolsa de café Etiopía Guji de Tostadero Norte"/);
    assert.ok(rules().has('vision:alt-mismatch'));
    assert.ok(rules().has('vision:alt-decorative'));
    const imperceptible = report.findings.find((f) => f.id === 'vision:focus-imperceptible')?.nodes.map((n) => n.selector) ?? [];
    for (const n of [1, 2, 3]) assert.ok(imperceptible.includes(`article.product:nth-of-type(${n}) > div.row > a.details`), `detalles ${n}`);
    assert.match(report.findings.find((f) => f.id === 'axe:button-name')?.nodes[0]?.fix?.after ?? '', /aria-label="Ver carrito"/);
    assert.ok(asker.calls > 0 && asker.calls <= 14);
  });

  it('adjunta evidencia visual', () => {
    assert.match(report.screenshot?.image ?? '', /^data:image\/jpeg;base64,/);
    const pair = report.findings.find((f) => f.id === 'keyboard:focus-invisible')?.nodes[0]?.evidence;
    assert.match(pair?.focused ?? '', /^data:image\/png;base64,/);
    assert.match(pair?.unfocused ?? '', /^data:image\/png;base64,/);
  });

  it('en modo público se niega a auditar la red local', async () => {
    await assert.rejects(
      audit(`${server.origin}/demo/index.html`, { network: 'public-only', vision: false, keyboard: false }),
      (error: unknown) => error instanceof AuditError && error.code === 'blocked_host',
    );
  });

  it('en un servicio público no expone el detalle de un fallo interno, pero lo entrega para registrarlo', async () => {
    const logged: unknown[] = [];
    const seen: AuditEvent[] = [];
    const broken = {
      calls: 0,
      ask: () => Promise.reject(new Error('C:\\ruta\\interna\\secreta.ts explotó')),
    } satisfies VisionAsker;
    const result = await audit(`${server.origin}/demo/index.html`, {
      keyboard: false,
      layout: false,
      vision: { client: broken, model: 'doble-roto' },
      exposeInternalErrors: false,
      onInternalError: (error) => logged.push(error),
      onEvent: (event) => seen.push(event),
    });
    const vision = result.phases.find((p) => p.id === 'vision');
    assert.equal(vision?.status, 'failed');
    assert.doesNotMatch(vision?.note ?? '', /secreta/);
    assert.ok(logged.some((e) => e instanceof Error && e.message.includes('secreta')));
    assert.ok(!JSON.stringify(seen).includes('secreta'));
  });
});

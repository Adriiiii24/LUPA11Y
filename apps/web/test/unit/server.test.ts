import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, utimes } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { makeFinding, makeReport } from '../../../../packages/core/test/helpers/fixtures.ts';
import { clientKey, createGate, gateConfig } from '../../lib/server/audit-gate.ts';
import { siteUrl } from '../../lib/site.ts';
import { externalizeImages, imageIndex, imageKey, imageResponse, KEY_PATTERN } from '../../lib/server/report-images.ts';
import { createFileStore } from '../../lib/server/report-store.ts';

describe('identidad del cliente', () => {
  const headers = new Headers({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.7, 192.0.2.1, 10.0.0.2' });

  it('no se fía de ninguna cabecera si el despliegue no lo declara', () => {
    assert.equal(clientKey(headers, gateConfig({})), null);
  });

  it('usa la cabecera declarada, o la de Vercel en Vercel', () => {
    assert.equal(clientKey(headers, gateConfig({ LUPA11Y_CLIENT_IP_HEADER: 'X-Real-IP' })), '203.0.113.9');
    assert.equal(clientKey(headers, gateConfig({ VERCEL: '1' })), '203.0.113.9');
  });

  it('con N proxies de confianza toma el salto N empezando por el final de x-forwarded-for', () => {
    assert.equal(clientKey(headers, gateConfig({ LUPA11Y_TRUSTED_PROXIES: '1' })), '10.0.0.2');
    assert.equal(clientKey(headers, gateConfig({ LUPA11Y_TRUSTED_PROXIES: '2' })), '192.0.2.1');
    assert.equal(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4' }), gateConfig({ LUPA11Y_TRUSTED_PROXIES: '2' })), null);
  });
});

describe('puerta de la API', () => {
  const config = { perClient: 2, global: 3, concurrent: 1, ipHeader: null, trustedProxies: 0 };

  it('«ocupado» no gasta cuota', () => {
    const gate = createGate(config);
    const first = gate.admit('a', 0);
    assert.ok(first.ok);
    const busy = gate.admit('a', 1);
    assert.deepEqual(busy, { ok: false, reason: 'busy', retryAfter: 15 });
    if (first.ok) first.release();
    const second = gate.admit('a', 2);
    assert.ok(second.ok, 'el segundo intento cuenta como el segundo, no como el tercero');
    if (second.ok) second.release();
    assert.equal(gate.admit('a', 3).ok, false);
  });

  it('aplica la cuota por cliente y el presupuesto global, y se recupera con la ventana', () => {
    const gate = createGate({ ...config, concurrent: 10 });
    const take = (key: string, at: number) => {
      const result = gate.admit(key, at);
      if (result.ok) result.release();
      return result;
    };
    assert.ok(take('a', 0).ok);
    assert.ok(take('a', 1).ok);
    const limited = take('a', 2);
    assert.equal(limited.ok ? null : limited.reason, 'client');
    assert.ok(take('b', 3).ok);
    const global = take('c', 4);
    assert.equal(global.ok ? null : global.reason, 'global');
    assert.ok(take('a', 10 * 60_000 + 5).ok, 'pasada la ventana vuelve a poder');
  });

  it('sin identidad de confianza, todos comparten una cuota', () => {
    const gate = createGate({ ...config, concurrent: 10, global: 100 });
    for (const at of [0, 1]) {
      const r = gate.admit(null, at);
      if (r.ok) r.release();
    }
    assert.equal(gate.admit(null, 2).ok, false);
  });
});

describe('imágenes fuera del informe', () => {
  const finding = makeFinding('axe:image-alt', 'critical', [{ selector: 'img', html: '<img>' }]);
  finding.nodes[0]!.evidence.crop = 'data:image/png;base64,iVBORw0KGgo=';
  const report = { ...makeReport([finding]), screenshot: { image: 'data:image/jpeg;base64,/9j/4AAQ', width: 1280, height: 800, truncated: false } };

  it('sustituye cada data URL por una URL con el hash de su contenido', () => {
    const light = externalizeImages(report, '/sample');
    const crop = light.findings[0]?.nodes[0]?.evidence.crop ?? '';
    assert.match(crop, /^\/sample\/[\w-]{20}\.png$/);
    assert.match(light.screenshot?.image ?? '', /\.jpg$/);
    assert.ok(KEY_PATTERN.test(crop.split('/').at(-1) ?? ''));
    assert.equal(imageIndex(report).get(imageKey(finding.nodes[0]!.evidence.crop!)), finding.nodes[0]!.evidence.crop);
  });

  it('sirve la imagen decodificada y cacheable para siempre, y 404 si no existe', async () => {
    const response = imageResponse('data:image/png;base64,iVBORw0KGgo=');
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.match(response.headers.get('cache-control') ?? '', /immutable/);
    assert.equal((await response.arrayBuffer()).byteLength, 8);
    assert.equal(imageResponse(undefined).status, 404);
    assert.equal(imageResponse('data:text/html;base64,PGgxPg==').status, 404);
  });
});

describe('almacén de informes', () => {
  const dirs: string[] = [];
  after(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });

  it('guarda con un id impredecible, lee lo guardado y rechaza ids raros y caducados', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lupa11y-store-'));
    dirs.push(dir);
    const store = createFileStore(dir, 60_000);
    const report = makeReport([makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }])]);
    const id = await store.save(report);
    assert.match(id, /^[\w-]{22}$/);
    assert.notEqual(await store.save(report), id);
    assert.equal((await store.load(id))?.findings[0]?.id, 'axe:region');
    assert.equal(await store.load('../../etc/passwd'), null);
    assert.equal(await store.load('a'.repeat(22)), null);

    const old = await store.save(report);
    const past = new Date(Date.now() - 120_000);
    await utimes(join(dir, `${old}.json`), past, past);
    assert.equal(await createFileStore(dir, 60_000).load(old), null, 'caducado');
  });
});

describe('Chromium de Vercel', () => {
  it('es de la misma versión mayor que el de Playwright', async () => {
    const require = createRequire(import.meta.url);
    const playwrightDir = dirname(require.resolve('playwright-core'));
    const browsers = JSON.parse(await readFile(join(playwrightDir, 'browsers.json'), 'utf8')) as { browsers: Array<{ name: string; browserVersion: string }> };
    const playwrightChromium = browsers.browsers.find((browser) => browser.name === 'chromium')?.browserVersion ?? '';
    const sparticuz = JSON.parse(await readFile(join(dirname(require.resolve('@sparticuz/chromium')), '..', 'package.json'), 'utf8')) as { version: string };
    assert.equal(sparticuz.version.split('.')[0], playwrightChromium.split('.')[0], 'al subir Playwright, sube @sparticuz/chromium a la misma versión mayor');
  });
});

describe('origen del sitio', () => {
  it('manda LUPA11Y_SITE_URL; en Vercel, si falta, el dominio de producción; si no, localhost', () => {
    assert.equal(siteUrl({ LUPA11Y_SITE_URL: 'https://lupa.example', VERCEL_PROJECT_PRODUCTION_URL: 'lupa11y.vercel.app' }).origin, 'https://lupa.example');
    assert.equal(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'lupa11y.vercel.app' }).origin, 'https://lupa11y.vercel.app');
    assert.equal(siteUrl({}).origin, 'http://localhost:3000');
    assert.equal(siteUrl({ LUPA11Y_SITE_URL: 'no es una url' }).origin, 'http://localhost:3000');
  });
});

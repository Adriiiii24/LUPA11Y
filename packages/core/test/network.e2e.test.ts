/**
 * La política de red con un Chromium de verdad: cabeceras que no salen del origen auditado,
 * el proxy de salida que cierra el DNS rebinding y el pool de navegadores.
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { chromium, type Browser } from 'playwright';
import { createBrowserPool } from '../src/browser-pool.ts';
import { startEgressProxy } from '../src/egress-proxy.ts';
import { installRequestGuard } from '../src/network-guard.ts';

interface Recorder {
  origin: string;
  port: number;
  seen: Array<{ path: string; headers: IncomingHttpHeaders }>;
  server: Server;
}

async function recorder(body: (origin: string) => string = () => 'ok'): Promise<Recorder> {
  const seen: Recorder['seen'] = [];
  let origin = '';
  const server = createServer((request, response) => {
    seen.push({ path: request.url ?? '', headers: request.headers });
    const isPage = request.url?.endsWith('.html');
    response.writeHead(200, { 'content-type': isPage ? 'text/html; charset=utf-8' : 'image/svg+xml' });
    response.end(isPage ? body(origin) : '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
  return { origin, port, seen, server };
}

describe('red', () => {
  let browser: Browser;
  let third: Recorder;
  let site: Recorder;

  before(async () => {
    browser = await chromium.launch();
    third = await recorder();
    site = await recorder((origin) => `<!doctype html><title>Tienda</title><img src="${origin}/propia.svg"><img src="${third.origin}/ajena.svg">`);
  });
  after(async () => {
    await browser.close();
    site.server.close();
    third.server.close();
  });

  it('las cabeceras de sesión solo viajan al origen auditado', async () => {
    const context = await browser.newContext();
    await installRequestGuard(context, 'any', { originHeaders: { origin: site.origin, headers: { 'X-Lupa11y-Token': 'secreto' } } });
    const page = await context.newPage();
    await page.goto(`${site.origin}/tienda.html`, { waitUntil: 'networkidle' });
    await context.close();
    assert.ok(site.seen.length >= 2);
    assert.ok(site.seen.every((r) => r.headers['x-lupa11y-token'] === 'secreto'));
    assert.ok(third.seen.length >= 1);
    assert.ok(third.seen.every((r) => r.headers['x-lupa11y-token'] === undefined));
  });

  it('el proxy de salida se conecta a la IP que validó, sin volver a preguntar al DNS', async () => {
    // «tienda.test» no existe en ningún DNS: si la página carga, es que el proxy usó su propia resolución.
    const proxy = await startEgressProxy({
      resolve: async (host) => {
        if (host === 'tienda.test') return [{ address: '127.0.0.1', family: 4 }];
        throw new Error(`destino no permitido: ${host}`);
      },
    });
    const context = await browser.newContext({ proxy: { server: proxy.url, bypass: '<-loopback>' } });
    const page = await context.newPage();
    const response = await page.goto(`http://tienda.test:${site.port}/tienda.html`);
    assert.equal(response?.status(), 200);
    assert.equal(await page.title(), 'Tienda');
    assert.ok(site.seen.some((r) => r.headers.host === `tienda.test:${site.port}`));
    await context.close();
    await proxy.close();
  });

  it('con la política pública, el proxy rechaza la red local aunque se llegue por IP', async () => {
    const proxy = await startEgressProxy();
    const context = await browser.newContext({ proxy: { server: proxy.url, bypass: '<-loopback>' } });
    const page = await context.newPage();
    const response = await page.goto(`${site.origin}/tienda.html`).catch(() => null);
    assert.notEqual(response?.status(), 200);
    assert.ok(proxy.blocked > 0, 'el proxy registra el bloqueo');
    await context.close();

    // Un túnel CONNECT hacia una IP privada (como haría un WebSocket o HTTPS) también se rechaza.
    const port = Number(new URL(proxy.url).port);
    const reply = await new Promise<string>((done, fail) => {
      const socket = connect({ host: '127.0.0.1', port }, () => socket.write('CONNECT 10.0.0.1:443 HTTP/1.1\r\nHost: 10.0.0.1:443\r\n\r\n'));
      socket.once('data', (chunk) => {
        done(chunk.toString('latin1'));
        socket.destroy();
      });
      socket.once('error', fail);
    });
    assert.match(reply, /^HTTP\/1\.1 403/);
    await proxy.close();
  });
});

describe('pool de navegadores', () => {
  it('reutiliza Chromium y jubila el navegador cuando ya no lo usa nadie', async () => {
    const pool = createBrowserPool({ maxUses: 2 });
    const first = await pool.acquire();
    const second = await pool.acquire();
    assert.equal(first.browser, second.browser, 'dos auditorías comparten navegador');
    const third = await pool.acquire();
    assert.notEqual(third.browser, first.browser, 'tras maxUses arranca uno nuevo');
    assert.ok(first.browser.isConnected(), 'el viejo sigue vivo mientras alguien lo usa');
    first.release();
    second.release();
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(first.browser.isConnected(), false, 'y se cierra al quedar libre');
    third.release();
    await pool.close();
    assert.equal(third.browser.isConnected(), false);
  });

  it('prepara las opciones de arranque con una función y cierra al soltar el último uso', async () => {
    let prepared = 0;
    const pool = createBrowserPool({
      maxUses: 1,
      launch: async () => {
        prepared += 1;
        return { args: ['--lang=es'] };
      },
    });
    const first = await pool.acquire();
    assert.equal(prepared, 1);
    first.release();
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(first.browser.isConnected(), false, 'con maxUses 1, cada auditoría tiene su propio Chromium');
    const second = await pool.acquire();
    assert.equal(prepared, 2);
    assert.notEqual(second.browser, first.browser);
    second.release();
    await pool.close();
  });
});

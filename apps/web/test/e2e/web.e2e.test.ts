/**
 * La web de verdad: el build de producción con `next start` y un Chromium que la usa como una persona.
 * Necesita `npm run build` antes (`npm run test:web` lo da por hecho, como la CI).
 *
 * Además de que funcione, comprueba lo que una auditoría de accesibilidad no se puede permitir en su
 * propia interfaz: que mueva la página sin pedirlo, que un Enter de más cancele el trabajo o que axe
 * encuentre infracciones graves en sus estados de uso.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Browser, type Page } from 'playwright';

const WEB = fileURLToPath(new URL('../..', import.meta.url));
const NEXT = createRequire(join(WEB, 'package.json')).resolve('next/dist/bin/next');

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });

/**
 * Infracciones de axe graves o críticas en la página tal y como está ahora. Antes espera a que acaben
 * las animaciones de entrada: a media animación la opacidad aún sube y el contraste medido no es el real.
 */
async function seriousViolations(page: Page): Promise<string[]> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Number.POSITIVE_INFINITY))
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

describe('web', () => {
  let server: ChildProcess;
  let origin: string;
  let browser: Browser;
  let reports: string;

  before(async () => {
    reports = await mkdtemp(join(tmpdir(), 'lupa11y-web-'));
    const port = await freePort();
    origin = `http://localhost:${port}`;
    server = spawn(process.execPath, [NEXT, 'start', '-p', String(port), '-H', 'localhost'], {
      cwd: WEB,
      env: { ...process.env, LUPA11Y_NETWORK: 'any', LUPA11Y_REPORTS_DIR: reports, GEMINI_API_KEY: '', LUPA11Y_QUOTA_PER_CLIENT: '50' },
      stdio: 'ignore',
    });
    const deadline = Date.now() + 60_000;
    for (;;) {
      const ok = await fetch(origin).then((r) => r.ok, () => false);
      if (ok) break;
      if (Date.now() > deadline) throw new Error('next start no respondió en 60 s (¿falta `npm run build`?)');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    browser = await chromium.launch();
  });

  after(async () => {
    await browser?.close();
    server?.kill();
    await rm(reports, { recursive: true, force: true });
  });

  it('la landing viaja ligera: las imágenes de la muestra se sirven aparte', async () => {
    const html = await (await fetch(origin)).text();
    assert.ok(html.length < 400_000, `HTML de ${html.length} bytes`);
    assert.ok((html.match(/data:image\//g) ?? []).length <= 1, 'como mucho el desenfoque del logo');
    const sampleImage = /\/sample\/[\w-]{20}\.(?:png|jpg)/.exec(html)?.[0];
    assert.ok(sampleImage, 'la muestra apunta a imágenes estáticas');
    const image = await fetch(new URL(sampleImage, origin));
    assert.equal(image.status, 200);
    assert.match(image.headers.get('cache-control') ?? '', /immutable/);
  });

  it('la demo rota a propósito carga sus imágenes también desde /demo', async () => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${origin}/demo`);
    const broken = await page.evaluate(() => [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src));
    assert.deepEqual(broken, []);
    await page.context().close();
  });

  it('publica robots, sitemap y la tarjeta para compartir', async () => {
    assert.match(await (await fetch(`${origin}/robots.txt`)).text(), /Disallow: \/demo/);
    assert.match(await (await fetch(`${origin}/sitemap.xml`)).text(), /<loc>/);
    const card = await fetch(`${origin}/opengraph-image`);
    assert.equal(card.status, 200);
    assert.equal(card.headers.get('content-type'), 'image/png');
    assert.match(await (await fetch(origin)).text(), /<meta property="og:image"/);
  });

  it('la interfaz no tiene infracciones graves de axe en su estado inicial ni con un hallazgo abierto', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin);
    assert.deepEqual(await seriousViolations(page), []);
    await page.getByRole('button', { name: /^1\. / }).click();
    await page.getByRole('tab', { name: /Teclado/ }).click();
    assert.deepEqual(await seriousViolations(page), []);
    await context.close();
  });

  it('un error de la API se anuncia y deja volver a la muestra', async () => {
    const page = await browser.newPage();
    await page.route('**/api/audit', (route) =>
      route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 'rate_limited', message: 'Has lanzado muchas auditorías seguidas.' }) }),
    );
    await page.goto(origin);
    await page.getByLabel('Dirección de la página').fill('https://ejemplo.test');
    await page.getByLabel('Dirección de la página').press('Enter');
    await page.getByRole('alert').getByText('Has lanzado muchas auditorías seguidas.').waitFor();
    await page.getByRole('button', { name: 'Volver a la muestra' }).click();
    await page.getByRole('button', { name: 'Auditar una URL' }).waitFor();
    await page.close();
  });

  it('audita de verdad, en directo, sin mover la página ni cancelar por un Enter de más', async () => {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    await page.goto(origin);
    const input = page.getByLabel('Dirección de la página');
    const live = page.locator('[aria-live="polite"][aria-atomic="true"]');

    await input.fill(`${origin}/demo`);
    await input.press('Enter');
    await live.filter({ hasText: 'Auditando' }).waitFor();
    // Un Enter más mientras audita no la cancela.
    await input.press('Enter');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Cancelar' }).waitFor();
    // La captura llega con la carga, antes del resultado.
    await page.getByRole('region', { name: /^Captura de/ }).waitFor({ timeout: 30_000 });
    assert.equal(await page.getByRole('button', { name: 'Cancelar' }).count(), 1, 'sigue auditando con la captura ya visible');

    await live.filter({ hasText: 'Auditoría terminada' }).waitFor({ timeout: 90_000 });
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'la ventana no se ha movido');
    assert.equal(await page.getByRole('tab', { name: /Hallazgos/ }).getAttribute('aria-selected'), 'true');
    assert.ok((await page.getByText('Zoom y espaciado').count()) > 0, 'la fase nueva aparece en el informe');

    // La misma página otra vez: el informe dice qué cambió.
    await input.press('Enter');
    await live.filter({ hasText: 'Frente a la vez anterior' }).waitFor({ timeout: 90_000 });
    await page.getByText('Frente a la auditoría anterior de esta página').waitFor();
    assert.deepEqual(await seriousViolations(page), []);

    // El enlace permanente lleva al informe guardado, con sus imágenes servidas aparte.
    await page.getByRole('button', { name: 'Copiar enlace' }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(link, /\/r\/[\w-]{22}$/);
    await page.goto(link);
    await page.getByRole('heading', { level: 1, name: /Informe de accesibilidad de localhost/ }).waitFor();
    const shot = await page.locator('img[src*="/img/"]').first().getAttribute('src');
    assert.equal((await fetch(new URL(shot ?? '', origin))).status, 200);
    assert.deepEqual(await seriousViolations(page), []);
    await context.close();
  });
});

/**
 * La función /api/audit solo con los ficheros que declara su traza, que es lo que Vercel empaqueta.
 * Si Playwright, axe, Gemini o el Chromium de Vercel leen en tiempo de ejecución algo que el trazado
 * no ve, falla aquí y no en producción (así faltó el browsers.json de Playwright). Necesita el build.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { after, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const ROUTE_DIR = join(ROOT, 'apps/web/.next/server/app/api/audit');

/** Lo mismo que importa y usa la ruta: Chromium, el árbol de accesibilidad, axe en español y Gemini. */
const CHECK = `
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { GoogleGenAI } from '@google/genai';
import es from 'axe-core/locales/es.json' with { type: 'json' };

const serverless = (await import('@sparticuz/chromium')).default;
if (!serverless.args.length || typeof GoogleGenAI !== 'function') throw new Error('módulos incompletos');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.setContent('<html lang="es"><body><img src="x.png"></body></html>');
await (await context.newCDPSession(page)).send('Accessibility.getFullAXTree');
const result = await new AxeBuilder({ page }).options({ locale: es }).analyze();
console.log(result.violations.map((violation) => violation.id).join(' '));
await browser.close();
`;

it('la función de la auditoría arranca Chromium y axe solo con sus ficheros trazados', async () => {
  const sandbox = await mkdtemp(join(tmpdir(), 'lupa11y-fn-'));
  after(() => rm(sandbox, { recursive: true, force: true }));
  const trace = JSON.parse(await readFile(join(ROUTE_DIR, 'route.js.nft.json'), 'utf8')) as { files: string[] };
  let copied = 0;
  for (const file of trace.files) {
    const source = resolve(ROUTE_DIR, file);
    const path = relative(ROOT, source);
    if (!path.startsWith(`node_modules${sep}`) || !(await lstat(source).catch(() => null))?.isFile()) continue;
    await mkdir(dirname(join(sandbox, path)), { recursive: true });
    await copyFile(source, join(sandbox, path));
    copied += 1;
  }
  assert.ok(copied > 100, `la traza lista ${copied} ficheros de node_modules`);
  assert.ok((await lstat(join(sandbox, 'node_modules/@sparticuz/chromium/bin/chromium.br')).catch(() => null))?.isFile(), 'el Chromium de Vercel va en la función');
  await writeFile(join(sandbox, 'check.mjs'), CHECK);
  const { stdout } = await promisify(execFile)(process.execPath, ['check.mjs'], { cwd: sandbox, timeout: 60_000 });
  assert.match(stdout, /image-alt/);
});

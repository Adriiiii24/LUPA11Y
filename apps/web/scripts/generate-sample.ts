/**
 * Genera `data/sample-report.json`: la auditoría REAL de la demo rota a propósito que la landing
 * muestra antes de que el visitante audite su propia URL.
 *
 *   npm run sample -w @lupa11y/web
 *
 * Sirve `public/` en un puerto local y audita `/demo/index.html` con el motor de verdad. Con
 * GEMINI_API_KEY en `apps/web/.env.local` incluye la fase de visión; sin ella, la marca como omitida.
 * La URL se reescribe al origen público del sitio (LUPA11Y_SITE_URL): la página es la misma, solo
 * cambia dónde se sirvió durante la generación.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { audit, Report } from '@lupa11y/core';
import { serveDirectory } from '../../../packages/core/test/helpers/static-server.ts';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const envFile = here('../.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const site = process.env['LUPA11Y_SITE_URL'] ?? 'http://localhost:3000';
const server = await serveDirectory(here('../public'));
try {
  const report = await audit(`${server.origin}/demo/index.html`, {
    // Es un proceso puntual: con el plan gratuito de Gemini (límites por minuto, saturación) la visión
    // puede tardar varios minutos, y aquí no hay ninguna petición web esperando.
    timeoutMs: 300_000,
    onEvent: (event) => {
      if (event.type === 'phase' && event.state !== 'running') process.stdout.write(`${event.phase}: ${event.message}\n`);
      if (event.type === 'log' && event.phase === 'vision') process.stdout.write(`  visión: ${event.message}\n`);
    },
  });
  const publicUrl = new URL('/demo', site).href;
  const sample = Report.parse({ ...report, url: publicUrl, finalUrl: publicUrl });
  await mkdir(here('../data'), { recursive: true });
  await writeFile(here('../data/sample-report.json'), `${JSON.stringify(sample)}\n`);
  process.stdout.write(`\nsample-report.json: ${sample.summary.total} hallazgos, ${(JSON.stringify(sample).length / 1024).toFixed(0)} KB\n`);
} finally {
  await server.close();
}

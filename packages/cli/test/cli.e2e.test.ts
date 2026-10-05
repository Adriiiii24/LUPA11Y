/**
 * La CLI de verdad, como la ejecuta la GitHub Action: códigos de salida, ficheros de salida,
 * línea base, varias páginas y sitemap. Las fases lentas se desactivan: aquí se prueba la CLI, no el motor.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { AuditBatch, Report } from '@lupa11y/core';
import { serveDirectory } from '../../core/test/helpers/static-server.ts';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const CLI = here('../src/main.ts');
const FAST = ['--no-vision', '--no-keyboard', '--no-layout'];

function run(args: string[], env: Record<string, string> = {}): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, GITHUB_ACTIONS: '', GEMINI_API_KEY: '', ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('CLI', () => {
  let server: Awaited<ReturnType<typeof serveDirectory>>;
  let dir: string;
  let demo: string;

  before(async () => {
    server = await serveDirectory(here('../../../apps/web/public'));
    dir = await mkdtemp(join(tmpdir(), 'lupa11y-cli-'));
    demo = `${server.origin}/demo/index.html`;
  });
  after(async () => {
    await server.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('enseña la ayuda y rechaza opciones inválidas con el código 2', async () => {
    const help = await run(['--help']);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /--baseline <ruta>/);
    const bad = await run([demo, '--fail-on', 'grave']);
    assert.equal(bad.code, 2);
    assert.match(bad.stderr, /--fail-on no acepta/);
    const header = await run([demo, '--header', 'sin dos puntos']);
    assert.equal(header.code, 2);
  });

  it('falla con 1 por encima del umbral y escribe JSON, SARIF y Markdown', async () => {
    const out = join(dir, 'informe.json');
    const sarif = join(dir, 'informe.sarif');
    const summary = join(dir, 'resumen.md');
    const result = await run([demo, ...FAST, '--fail-on', 'critical', '--out', out, '--sarif', sarif, '--summary', summary], { GITHUB_ACTIONS: 'true' });
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stdout, /::error title=Crítica/);
    const report = Report.parse(JSON.parse(await readFile(out, 'utf8')));
    assert.ok(report.findings.some((f) => f.id === 'axe:button-name'));
    const log = JSON.parse(await readFile(sarif, 'utf8')) as { version: string; runs: Array<{ results: unknown[] }> };
    assert.equal(log.version, '2.1.0');
    assert.ok((log.runs[0]?.results.length ?? 0) > 0);
    assert.match(await readFile(summary, 'utf8'), /## LupA11y: Tostadero Norte/);
  });

  it('con --baseline solo falla por lo que empeora', async () => {
    const baseline = join(dir, 'informe.json');
    const same = await run([demo, ...FAST, '--fail-on', 'low', '--baseline', baseline]);
    assert.equal(same.code, 0, same.stderr);
    assert.match(same.stdout, /siguen igual/);

    // Una línea base sin hallazgos hace que todo cuente como nuevo.
    const empty = join(dir, 'vacia.json');
    const parsed = Report.parse(JSON.parse(await readFile(baseline, 'utf8')));
    await writeFile(empty, JSON.stringify({ ...parsed, findings: [], summary: { ...parsed.summary, total: 0 } }));
    const worse = await run([demo, ...FAST, '--fail-on', 'critical', '--baseline', empty]);
    assert.equal(worse.code, 1);
    assert.match(worse.stdout, /nuevo/);
  });

  it('audita varias páginas y las lee de un sitemap, con un lote como salida', async () => {
    const sitemap = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/xml' });
      response.end(`<urlset><url><loc>${demo}</loc></url><url><loc>${demo}?variante=2</loc></url></urlset>`);
    });
    await new Promise<void>((done) => sitemap.listen(0, '127.0.0.1', done));
    const { port } = sitemap.address() as AddressInfo;
    const out = join(dir, 'lote.json');
    const result = await run(['--sitemap', `http://127.0.0.1:${port}/sitemap.xml`, ...FAST, '--fail-on', 'none', '--out', out, '--no-images']);
    sitemap.close();
    assert.equal(result.code, 0, result.stderr);
    const batch = AuditBatch.parse(JSON.parse(await readFile(out, 'utf8')));
    assert.equal(batch.reports.length, 2);
    assert.ok(batch.reports.every((r) => r.screenshot === null));
    assert.match(result.stderr, /\[2\/2\]/);
  });

  it('devuelve 2 si una página no se puede auditar', async () => {
    const result = await run(['http://127.0.0.1:1/', ...FAST]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /No se pudo cargar la página/);
  });
});

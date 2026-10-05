/** El servidor MCP de verdad, por stdio, con el cliente oficial del SDK. */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { serveDirectory } from '../../core/test/helpers/static-server.ts';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

describe('servidor MCP', () => {
  let server: Awaited<ReturnType<typeof serveDirectory>>;
  const client = new Client({ name: 'lupa11y-test', version: '0.0.0' });

  before(async () => {
    server = await serveDirectory(here('../../../apps/web/public'));
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [here('../src/server.ts')], stderr: 'pipe' }));
  });
  after(async () => {
    await client.close();
    await server.close();
  });

  it('expone audit_url como herramienta de solo lectura', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'audit_url');
    assert.ok(tool);
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}).sort(), ['compare', 'format', 'layout', 'level', 'max_findings', 'url', 'vision']);
    assert.ok(tool.outputSchema, 'declara la salida estructurada');
  });

  it('audita la demo, informa del progreso y devuelve Markdown con diffs y un resumen estructurado', async () => {
    const progress: string[] = [];
    const result = await client.callTool(
      { name: 'audit_url', arguments: { url: `${server.origin}/demo/index.html`, vision: false } },
      undefined,
      { onprogress: (p) => progress.push(p.message ?? ''), timeout: 120_000 },
    );
    const [first] = result.content as Array<{ type: string; text: string }>;
    assert.equal(result.isError, undefined);
    assert.match(first?.text ?? '', /Trampa de teclado/);
    assert.match(first?.text ?? '', /```diff/);
    assert.ok(progress.length >= 4, `progreso recibido: ${progress.length}`);
    const structured = result.structuredContent as { total: number; changes: unknown; findings: Array<{ id: string }> };
    assert.ok(structured.total > 0);
    assert.equal(structured.changes, null, 'la primera auditoría no tiene con qué compararse');
    assert.ok(structured.findings.some((f) => f.id === 'keyboard:keyboard-trap'));
  });

  it('la segunda auditoría de la misma URL dice qué cambió', async () => {
    const result = await client.callTool(
      { name: 'audit_url', arguments: { url: `${server.origin}/demo/index.html#otra-vez`, vision: false, layout: false } },
      undefined,
      { timeout: 120_000 },
    );
    const [changes] = result.content as Array<{ type: string; text: string }>;
    assert.match(changes?.text ?? '', /## Cambios desde la auditoría anterior/);
    const structured = result.structuredContent as { changes: { resolved: string[]; added: string[]; unchanged: number } };
    assert.ok(!structured.changes.resolved.includes('layout:reflow'), 'sin la fase de zoom, el reflujo no cuenta como resuelto');
    assert.deepEqual(structured.changes.added, []);
    assert.ok(structured.changes.unchanged > 0);
  });

  it('devuelve un error de herramienta, no una excepción, ante una URL inválida', async () => {
    const result = await client.callTool({ name: 'audit_url', arguments: { url: 'ftp://nada' } });
    assert.equal(result.isError, true);
    assert.match((result.content as Array<{ text: string }>)[0]?.text ?? '', /invalid_url/);
  });
});

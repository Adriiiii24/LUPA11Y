import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AuditEvent } from '@lupa11y/core/schema';
import { makeFinding, makeReport } from '../../../../packages/core/test/helpers/fixtures.ts';
import { applyPartial, liveReport, type LiveAudit } from '../../lib/live-report.ts';
import { readNdjson } from '../../lib/ndjson.ts';

const streamOf = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

describe('readNdjson', () => {
  it('reconstruye líneas partidas entre trozos, ignora las vacías y acepta la última sin salto', async () => {
    const lines: string[] = [];
    await readNdjson(streamOf('{"a":', '1}\n\n{"b"', ':2}\n{"c":3}'), (line) => lines.push(line));
    assert.deepEqual(lines, ['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it('no parte un carácter multibyte que llega en dos trozos', async () => {
    const bytes = new TextEncoder().encode('{"t":"á"}\n');
    const lines: string[] = [];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 7));
        controller.enqueue(bytes.slice(7));
        controller.close();
      },
    });
    await readNdjson(body, (line) => lines.push(line));
    assert.deepEqual(lines, ['{"t":"á"}']);
  });
});

describe('informe provisional', () => {
  const base = makeReport([]);
  const capture: Extract<AuditEvent, { type: 'capture' }> = {
    type: 'capture',
    url: base.url,
    finalUrl: base.finalUrl,
    title: 'Tienda',
    viewport: base.viewport,
    wcagLevel: 'AA',
    screenshot: { image: 'data:image/jpeg;base64,AAAA', width: 1280, height: 900, truncated: false },
  };

  it('cada fase sustituye sus propios hallazgos y el total se recalcula', () => {
    let live: LiveAudit = { capture, findings: {}, keyboard: null };
    live = applyPartial(live, { type: 'partial', phase: 'axe', findings: [makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }])], keyboard: null });
    live = applyPartial(live, { type: 'partial', phase: 'layout', findings: [makeFinding('layout:reflow', 'high', [{ selector: 'header', html: '<header>' }])], keyboard: null });
    live = applyPartial(live, { type: 'partial', phase: 'load', findings: [], keyboard: null });
    const report = liveReport(live, '2026-10-04T10:00:00.000Z');
    assert.deepEqual(report.findings.map((f) => f.id), ['layout:reflow', 'axe:region'], 'ordenado por severidad');
    assert.equal(report.summary.total, 2);
    assert.equal(report.summary.bySource.layout, 1);
    assert.equal(report.screenshot?.height, 900);
  });
});

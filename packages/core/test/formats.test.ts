import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeFix } from '../src/findings.ts';
import { toMarkdown, toMarkdownBatch } from '../src/format.ts';
import { toSarif } from '../src/sarif.ts';
import { AuditBatch, parseReport, parseReports, Report, SCHEMA_VERSION } from '../src/schema.ts';
import { makeFinding, makeReport } from './helpers/fixtures.ts';

const add = (n: number) => ({ selector: `article:nth-of-type(${n}) > div.add`, html: '<div class="add" role="button" tabindex="0">Añadir</div>' });

describe('esquema', () => {
  it('migra un informe de la versión 1, que no conocía la fuente layout', () => {
    const current = makeReport([makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }])]);
    const { layout: _dropped, ...bySource } = current.summary.bySource;
    const legacy = { ...current, schemaVersion: 1, summary: { ...current.summary, bySource } };
    assert.equal(Report.safeParse(legacy).success, false);
    const migrated = parseReport(legacy);
    assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
    assert.equal(migrated.summary.bySource.layout, 0);
  });

  it('lee tanto un informe suelto como un lote de varias páginas', () => {
    const one = makeReport([]);
    const batch: AuditBatch = { schemaVersion: SCHEMA_VERSION, generatedAt: '2026-10-04T10:00:00.000Z', reports: [one, makeReport([], 'https://tienda.example/pago')] };
    assert.equal(parseReports(one).length, 1);
    assert.equal(parseReports(batch).length, 2);
    assert.equal(AuditBatch.safeParse(batch).success, true);
  });
});

describe('Markdown por lotes', () => {
  it('resume cada página en una tabla y baja un nivel los títulos', () => {
    const md = toMarkdownBatch([
      makeReport([makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }])]),
      makeReport([], 'https://tienda.example/pago'),
    ]);
    assert.match(md, /## LupA11y: 2 páginas/);
    assert.match(md, /\| https:\/\/tienda\.example\/pago \| 0 \| 0 \| 0 \| 0 \|/);
    assert.match(md, /^### LupA11y: Tienda/m);
    assert.match(md, /^#### Media: Título de region/m);
  });

  it('con una sola página es el Markdown de siempre', () => {
    const report = makeReport([]);
    assert.equal(toMarkdownBatch([report]), toMarkdown(report));
  });
});

describe('SARIF', () => {
  const fixed = makeFinding('axe:color-contrast', 'high', [{ selector: '.notes', html: '<p class="notes">' }]);
  fixed.nodes[0]!.fix = makeFix({ summary: 'Sube el contraste.', language: 'css', before: '.notes {\n  color: #bbb;\n}', after: '.notes {\n  color: #666;\n}', origin: 'deterministic' }, 'styles.css');
  const log = toSarif(
    [
      makeReport([fixed, makeFinding('keyboard:keyboard-inoperable', 'high', [add(1), add(2), add(3)])]),
      makeReport([makeFinding('axe:color-contrast', 'low', [{ selector: '.pie', html: '<p class="pie">' }])], 'https://tienda.example/pago'),
    ],
    { toolVersion: '0.2.0' },
  ) as { version: string; runs: Array<{ tool: { driver: { rules: Array<{ id: string }> } }; results: Array<Record<string, unknown>> }> };
  const [run] = log.runs;

  it('declara cada regla una vez y un resultado por nodo', () => {
    assert.equal(log.version, '2.1.0');
    assert.deepEqual(run?.tool.driver.rules.map((r) => r.id), ['axe:color-contrast', 'keyboard:keyboard-inoperable']);
    assert.equal(run?.results.length, 5);
  });

  it('ubica cada resultado en su URL y su selector, con el arreglo en las propiedades', () => {
    const first = run?.results[0] as {
      level: string;
      ruleIndex: number;
      locations: Array<{ physicalLocation: { artifactLocation: { uri: string } }; logicalLocations: Array<{ fullyQualifiedName: string }> }>;
      properties: { fix?: { diff: string } };
    };
    assert.equal(first.level, 'error');
    assert.equal(first.ruleIndex, 0);
    assert.equal(first.locations[0]?.physicalLocation.artifactLocation.uri, 'https://tienda.example/');
    assert.equal(first.locations[0]?.logicalLocations[0]?.fullyQualifiedName, '.notes');
    assert.match(first.properties.fix?.diff ?? '', /\+  color: #666;/);
    assert.equal((run?.results[4] as { level: string }).level, 'note');
  });

  it('da huellas distintas a nodos idénticos y estables entre ejecuciones', () => {
    const prints = run?.results.slice(1, 4).map((r) => (r['partialFingerprints'] as Record<string, string>)['lupa11y/v1']) ?? [];
    assert.equal(new Set(prints).size, 3);
    assert.match(prints[1] ?? '', /:1$/);
    const again = toSarif([makeReport([makeFinding('keyboard:keyboard-inoperable', 'high', [add(4), add(5), add(6)])])]) as typeof log;
    assert.deepEqual(again.runs[0]?.results.map((r) => (r['partialFingerprints'] as Record<string, string>)['lupa11y/v1']), prints);
  });
});

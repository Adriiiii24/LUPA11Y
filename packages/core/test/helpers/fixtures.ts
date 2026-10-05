/** Hallazgos e informes mínimos para los tests de las funciones puras. */
import { finding, node, type NodeInput } from '../../src/findings.ts';
import { PHASES, SCHEMA_VERSION, type Finding, type Report, type Severity, type Source } from '../../src/schema.ts';

export function makeFinding(id: `${Source}:${string}`, severity: Severity, nodes: Array<Pick<NodeInput, 'selector' | 'html'>>, occurrences?: number): Finding {
  const [source, rule] = id.split(':') as [Source, string];
  return finding({
    source,
    rule,
    title: `Título de ${rule}`,
    detail: `Detalle de ${rule}`,
    severity,
    wcag: [{ criterion: '1.4.3', level: 'AA' }],
    nodes: nodes.map((n) => node(n)),
    ...(occurrences === undefined ? {} : { occurrences }),
  });
}

export function makeReport(findings: Finding[], url = 'https://tienda.example/'): Report {
  const count = <K extends string>(keys: readonly K[], pick: (f: Finding) => K) =>
    Object.fromEntries(keys.map((k) => [k, findings.filter((f) => pick(f) === k).length])) as Record<K, number>;
  return {
    schemaVersion: SCHEMA_VERSION,
    url,
    finalUrl: url,
    title: 'Tienda',
    lang: 'es',
    auditedAt: '2026-10-04T10:00:00.000Z',
    durationMs: 1234,
    viewport: { width: 1280, height: 800 },
    wcagLevel: 'AA',
    engines: { axe: '4.13.0', browser: 'Chromium 153', visionModel: null },
    phases: PHASES.map((id) => ({ id, status: 'done' as const, durationMs: 100, note: null })),
    summary: {
      total: findings.length,
      bySeverity: count(['critical', 'high', 'medium', 'low'] as const, (f) => f.severity),
      bySource: count(['axe', 'layout', 'keyboard', 'vision'] as const, (f) => f.source),
    },
    screenshot: null,
    keyboard: null,
    findings,
  };
}

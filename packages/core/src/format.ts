/**
 * Textos y formatos compartidos por la web, la CLI y el MCP. Sin dependencias del motor:
 * el cliente web lo importa tal cual.
 */
import type { ReportComparison } from './compare.ts';
import type { KeyboardOutcome, PhaseId, PhaseResult, Report, Severity, Source } from './schema.ts';

export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };

export const SOURCE_LABEL: Record<Source, string> = { axe: 'axe-core', layout: 'Zoom y espaciado', keyboard: 'Teclado', vision: 'Visión' };

export const PHASE_LABEL: Record<PhaseId, string> = {
  load: 'Carga',
  axe: 'axe-core',
  layout: 'Zoom y espaciado',
  keyboard: 'Agente de teclado',
  vision: 'Gemini Vision',
};

export const PHASE_STATUS_LABEL: Record<PhaseResult['status'], string> = { done: 'hecha', skipped: 'omitida', failed: 'fallida' };

export const OUTCOME_LABEL: Record<KeyboardOutcome, string> = {
  closed: 'el ciclo de Tab se cierra',
  trap: 'trampa de teclado',
  modal: 'el foco queda dentro de un diálogo modal',
  'escaped-loop': 'bucle con salida por Escape o Shift+Tab',
  limit: 'se alcanzó el límite de paradas',
  empty: 'no hay elementos enfocables',
};

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

const criteriaOf = (finding: Report['findings'][number]) =>
  finding.wcag.map((w) => `${w.criterion}${w.level ? ` (${w.level})` : ''}`).join(', ') || 'buena práctica';

/** Resumen en Markdown: GITHUB_STEP_SUMMARY, comentario de PR o respuesta MCP. */
export function toMarkdown(report: Report, options: { maxFindings?: number; includeDiffs?: boolean; heading?: string } = {}): string {
  const { maxFindings = 25, includeDiffs = true, heading = '##' } = options;
  const { bySeverity } = report.summary;
  const lines = [
    `${heading} LupA11y: ${report.title || report.finalUrl}`,
    '',
    `${report.finalUrl}, WCAG 2.2 ${report.wcagLevel}, ${new Date(report.auditedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '| Crítica | Alta | Media | Baja |',
    '| :-: | :-: | :-: | :-: |',
    `| ${bySeverity.critical} | ${bySeverity.high} | ${bySeverity.medium} | ${bySeverity.low} |`,
    '',
    '| Fase | Estado | Nota |',
    '| --- | --- | --- |',
    ...report.phases.map((p) => `| ${PHASE_LABEL[p.id]} | ${PHASE_STATUS_LABEL[p.status]} | ${cell(p.note ?? '')} |`),
    '',
  ];
  if (report.findings.length === 0) {
    lines.push('Sin hallazgos automáticos. Recuerda: una auditoría automática no certifica el cumplimiento.');
    return lines.join('\n');
  }
  for (const finding of report.findings.slice(0, maxFindings)) {
    lines.push(
      `${heading}# ${SEVERITY_LABEL[finding.severity]}: ${finding.title}`,
      '',
      `${SOURCE_LABEL[finding.source]}, regla \`${finding.rule}\`, WCAG ${criteriaOf(finding)}, ${finding.occurrences} ${finding.occurrences === 1 ? 'nodo' : 'nodos'}.`,
      '',
      finding.detail,
      '',
    );
    for (const node of finding.nodes.slice(0, 3)) {
      lines.push(`- \`${cell(node.selector)}\`${node.note ? `: ${cell(node.note)}` : ''}`);
      if (includeDiffs && node.fix) lines.push('', '  ```diff', ...node.fix.diff.split('\n').map((l) => `  ${l}`), '  ```', '');
    }
    lines.push('');
  }
  if (report.findings.length > maxFindings) lines.push(`… y ${report.findings.length - maxFindings} hallazgos más en el JSON.`);
  return lines.join('\n');
}

/** Varias páginas: una tabla de conjunto y después cada página con menos detalle. */
export function toMarkdownBatch(reports: readonly Report[], options: { maxFindings?: number; includeDiffs?: boolean } = {}): string {
  const [only] = reports;
  if (reports.length === 1 && only) return toMarkdown(only, options);
  const lines = [
    `## LupA11y: ${reports.length} páginas`,
    '',
    '| Página | Crítica | Alta | Media | Baja |',
    '| --- | :-: | :-: | :-: | :-: |',
    ...reports.map(({ finalUrl, summary: { bySeverity: s } }) => `| ${cell(finalUrl)} | ${s.critical} | ${s.high} | ${s.medium} | ${s.low} |`),
    '',
  ];
  const perPage = Math.max(3, Math.floor((options.maxFindings ?? 25) / reports.length));
  for (const report of reports) lines.push(toMarkdown(report, { ...options, maxFindings: perPage, heading: '###' }), '');
  return lines.join('\n');
}

const titleList = (items: ReadonlyArray<{ severity: Severity; title: string }>, max = 8) => [
  ...items.slice(0, max).map((f) => `- ${SEVERITY_LABEL[f.severity]}: ${f.title}`),
  ...(items.length > max ? [`- … y ${items.length - max} más`] : []),
];

/** Lo que cambió desde la auditoría anterior, para la CLI con `--baseline` y para el MCP. */
export function comparisonToMarkdown(comparison: ReportComparison, options: { heading?: string } = {}): string {
  const { heading = '###' } = options;
  const worse = comparison.changed.filter((c) => c.newNodes.length > 0 || c.occurrencesAfter > c.occurrencesBefore);
  const better = comparison.changed.filter((c) => c.newNodes.length === 0 && c.occurrencesAfter <= c.occurrencesBefore);
  const resolvedNodes = comparison.changed.reduce((n, c) => n + c.resolvedNodes.length, 0);
  const lines = [
    `${heading} Cambios desde la auditoría anterior`,
    '',
    `${comparison.resolved.length} reglas resueltas, ${comparison.added.length} nuevas, ${worse.length} empeoran, ${better.length} mejoran (${resolvedNodes} nodos arreglados) y ${comparison.unchanged.length} siguen igual.`,
    ...(comparison.incomparable.length > 0
      ? [
          '',
          `${comparison.incomparable.length} hallazgos de fases que no se completaron en las dos auditorías (sin clave de Gemini, desactivadas o fallidas) no se comparan.`,
        ]
      : []),
  ];
  if (comparison.resolved.length > 0) lines.push('', 'Resueltas:', ...titleList(comparison.resolved));
  if (comparison.added.length > 0) lines.push('', 'Nuevas:', ...titleList(comparison.added));
  if (worse.length > 0) {
    lines.push(
      '',
      'Empeoran:',
      ...worse.slice(0, 8).map((c) => `- ${SEVERITY_LABEL[c.finding.severity]}: ${c.finding.title} (${c.occurrencesBefore} → ${c.occurrencesAfter} nodos)`),
    );
  }
  return lines.join('\n');
}

/** Copia del informe sin imágenes: para contextos de LLM (MCP) o artefactos de CI ligeros. */
export function withoutImages(report: Report): Report {
  return {
    ...report,
    screenshot: null,
    findings: report.findings.map((f) => ({
      ...f,
      nodes: f.nodes.map((n) => ({ ...n, evidence: { crop: null, unfocused: null, focused: null } })),
    })),
  };
}

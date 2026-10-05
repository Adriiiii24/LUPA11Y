/**
 * El informe provisional mientras la auditoría sigue en marcha: la captura llega con la carga y los
 * hallazgos, fase a fase. Tiene la forma de un `Report` para que el visor lo pinte igual; el
 * definitivo lo sustituye en cuanto llega.
 */
import { SCHEMA_VERSION, SEVERITIES, SOURCES, type AuditEvent, type Finding, type KeyboardMap, type Report, type Severity, type Source } from '@lupa11y/core/schema';

export interface LiveAudit {
  capture: Extract<AuditEvent, { type: 'capture' }>;
  findings: Partial<Record<Source, Finding[]>>;
  keyboard: KeyboardMap | null;
}

const RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const isSource = (phase: string): phase is Source => (SOURCES as readonly string[]).includes(phase);

/** Cada fase sustituye sus propios hallazgos: su parcial es todo lo que esa fase encontró. */
export function applyPartial(live: LiveAudit, event: Extract<AuditEvent, { type: 'partial' }>): LiveAudit {
  if (!isSource(event.phase)) return live;
  return {
    ...live,
    findings: { ...live.findings, [event.phase]: event.findings },
    keyboard: event.keyboard ?? live.keyboard,
  };
}

export function liveReport(live: LiveAudit, startedAt: string): Report {
  const findings = SOURCES.flatMap((source) => live.findings[source] ?? []).sort(
    (a, b) => RANK[a.severity] - RANK[b.severity] || SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source) || b.occurrences - a.occurrences,
  );
  const { capture } = live;
  return {
    schemaVersion: SCHEMA_VERSION,
    url: capture.url,
    finalUrl: capture.finalUrl,
    title: capture.title,
    lang: null,
    auditedAt: startedAt,
    durationMs: 0,
    viewport: capture.viewport,
    wcagLevel: capture.wcagLevel,
    engines: { axe: '…', browser: 'Chromium', visionModel: null },
    phases: [],
    summary: {
      total: findings.length,
      bySeverity: Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length])) as Record<Severity, number>,
      bySource: Object.fromEntries(SOURCES.map((s) => [s, findings.filter((f) => f.source === s).length])) as Record<Source, number>,
    },
    screenshot: capture.screenshot,
    keyboard: live.keyboard,
    findings,
  };
}

/**
 * Exportación a SARIF 2.1.0, el formato que entiende el escaneo de código de GitHub.
 *
 * Una auditoría de una URL no apunta a un fichero del repositorio: la ubicación es la propia URL,
 * con el fragmento HTML como extracto y el selector como ubicación lógica. Cada nodo es un
 * resultado y su huella (`partialFingerprints`) es la misma que usa `--baseline`, así GitHub
 * reconoce la alerta entre ejecuciones aunque cambie el orden de los hermanos.
 * Sin dependencias del motor: la web lo usa en el cliente para la descarga.
 */
import { nodeFingerprint } from './compare.ts';
import { SOURCE_LABEL } from './format.ts';
import type { Finding, Report, Severity } from './schema.ts';

type SarifLevel = 'error' | 'warning' | 'note';

const LEVEL: Record<Severity, SarifLevel> = { critical: 'error', high: 'error', medium: 'warning', low: 'note' };

/** Severidad numérica de GitHub (0-10): ordena las alertas en la pestaña de seguridad. */
const SCORE: Record<Severity, string> = { critical: '9.0', high: '7.0', medium: '5.0', low: '2.0' };

export interface SarifOptions {
  toolVersion?: string;
  informationUri?: string;
}

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: unknown[];
}

function rule(finding: Finding) {
  const criteria = finding.wcag.map((w) => `wcag${w.criterion}`);
  return {
    id: finding.id,
    name: finding.rule,
    shortDescription: { text: finding.title },
    fullDescription: { text: finding.detail },
    ...(finding.helpUrl ? { helpUri: finding.helpUrl } : {}),
    help: {
      text: `${finding.detail} Fuente: ${SOURCE_LABEL[finding.source]}.`,
      markdown: `${finding.detail}\n\nFuente: **${SOURCE_LABEL[finding.source]}**. ${
        finding.wcag.length ? `WCAG ${finding.wcag.map((w) => `${w.criterion}${w.level ? ` (${w.level})` : ''}`).join(', ')}.` : 'Buena práctica.'
      }`,
    },
    defaultConfiguration: { level: LEVEL[finding.severity] },
    properties: {
      tags: ['accessibility', 'a11y', `lupa11y/${finding.source}`, ...criteria],
      precision: finding.source === 'vision' ? 'medium' : 'high',
      'problem.severity': finding.severity === 'low' ? 'recommendation' : LEVEL[finding.severity],
      'security-severity': SCORE[finding.severity],
    },
  };
}

export function toSarif(reports: readonly Report[], options: SarifOptions = {}): SarifLog {
  const rules = new Map<string, ReturnType<typeof rule>>();
  const results: unknown[] = [];

  for (const report of reports) {
    for (const finding of report.findings) {
      if (!rules.has(finding.id)) rules.set(finding.id, rule(finding));
      const ruleIndex = [...rules.keys()].indexOf(finding.id);
      const seen = new Map<string, number>();
      for (const node of finding.nodes) {
        // Nodos idénticos (tres botones iguales) comparten huella: el ordinal los distingue.
        const base = nodeFingerprint(finding, node);
        const ordinal = seen.get(base) ?? 0;
        seen.set(base, ordinal + 1);
        results.push({
          ruleId: finding.id,
          ruleIndex,
          level: LEVEL[finding.severity],
          message: { text: [finding.title, node.note, node.fix?.summary].filter(Boolean).join(' ') },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: report.finalUrl },
                region: { startLine: 1, snippet: { text: node.html } },
              },
              logicalLocations: [{ fullyQualifiedName: node.selector, kind: 'element' }],
            },
          ],
          partialFingerprints: { 'lupa11y/v1': ordinal === 0 ? base : `${base}:${ordinal}` },
          properties: {
            source: finding.source,
            severity: finding.severity,
            occurrences: finding.occurrences,
            ...(finding.confidence !== null ? { confidence: finding.confidence } : {}),
            ...(node.fix ? { fix: { origin: node.fix.origin, language: node.fix.language, diff: node.fix.diff } } : {}),
          },
        });
      }
    }
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'LupA11y',
            ...(options.informationUri ? { informationUri: options.informationUri } : {}),
            ...(options.toolVersion ? { semanticVersion: options.toolVersion } : {}),
            rules: [...rules.values()],
          },
        },
        invocations: reports.map((report) => ({
          executionSuccessful: report.phases.every((phase) => phase.status !== 'failed'),
          endTimeUtc: new Date(Date.parse(report.auditedAt) + report.durationMs).toISOString(),
          properties: { url: report.finalUrl, phases: report.phases },
        })),
        results,
      },
    ],
  };
}

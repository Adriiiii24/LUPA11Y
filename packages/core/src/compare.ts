/**
 * Comparación entre dos auditorías de la misma página: qué es nuevo, qué se resolvió y qué sigue.
 *
 * Es lo que permite a la CI fallar solo por lo que empeora (`--baseline`) y al MCP contestar
 * «arreglados / nuevos / siguen» en el bucle de audita, arregla y vuelve a auditar.
 *
 * Los nodos se emparejan por huella. Primero de forma exacta (selector + etiqueta de apertura) y,
 * con lo que sobra, sin los índices `:nth-of-type`, que cambian en cuanto se añade un hermano.
 * Las huellas se cuentan como multiconjunto: tres botones idénticos son tres apariciones.
 * Sin dependencias del motor: la web lo usa en el cliente.
 */
import { meetsThreshold, type Finding, type FindingNode, type Report, type Severity, type Source } from './schema.ts';

/** Atributos que identifican un elemento y no suelen cambiar al arreglarlo. */
const STABLE_ATTRIBUTES = new Set(['href', 'src', 'type', 'role', 'name', 'for', 'action']);

const OPEN_TAG = /^\s*<([a-z][\w:-]*)([^>]*)>/i;
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Etiqueta de apertura reducida a su nombre y sus atributos estables, en orden. */
export function normalizeTag(html: string): string {
  const open = OPEN_TAG.exec(html);
  if (!open) return html.trim().slice(0, 80);
  const attributes: string[] = [];
  for (const match of (open[2] ?? '').matchAll(ATTRIBUTE)) {
    const name = match[1]?.toLowerCase() ?? '';
    if (!STABLE_ATTRIBUTES.has(name)) continue;
    attributes.push(`${name}=${match[2] ?? match[3] ?? match[4] ?? ''}`);
  }
  return `<${open[1]?.toLowerCase()}${attributes.sort().map((a) => ` ${a}`).join('')}>`;
}

/** Selector sin los índices posicionales. */
export const looseSelector = (selector: string): string => selector.replace(/:nth-(?:of-type|child)\(\d+\)/g, '');

const exactKey = (finding: Pick<Finding, 'id'>, node: Pick<FindingNode, 'selector' | 'html'>) =>
  `${finding.id}|${node.selector}|${normalizeTag(node.html)}`;

const looseKey = (finding: Pick<Finding, 'id'>, node: Pick<FindingNode, 'selector' | 'html'>) =>
  `${finding.id}|${looseSelector(node.selector)}|${normalizeTag(node.html)}`;

/** cyrb53: un hash de 53 bits rápido y sin dependencias; suficiente para identificar, no para seguridad. */
function cyrb53(text: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** Huella estable de un nodo, independiente de su posición entre hermanos. La usa también SARIF. */
export const nodeFingerprint = (finding: Pick<Finding, 'id'>, node: Pick<FindingNode, 'selector' | 'html'>): string =>
  cyrb53(looseKey(finding, node));

export interface FindingChange {
  finding: Finding;
  newNodes: FindingNode[];
  resolvedNodes: FindingNode[];
  occurrencesBefore: number;
  occurrencesAfter: number;
}

export interface ReportComparison {
  /** Reglas que antes no fallaban. */
  added: Finding[];
  /** Reglas que ya no fallan (el hallazgo es el del informe anterior). */
  resolved: Finding[];
  /** Reglas que siguen fallando con nodos nuevos, nodos resueltos o un número distinto de apariciones. */
  changed: FindingChange[];
  /** Reglas que siguen exactamente igual. */
  unchanged: Finding[];
  /**
   * Hallazgos de una fase que no se completó en las dos auditorías (la visión sin clave, una fase
   * desactivada o fallida): no se pueden comparar y no cuentan ni como nuevos ni como resueltos.
   */
  incomparable: Finding[];
}

type Comparable = Pick<Report, 'findings'> & Partial<Pick<Report, 'phases'>>;

/** true si la fase de esa fuente se completó. Sin datos de fases (una línea base vacía), se asume que sí. */
const ran = (report: Comparable, source: Source) => !report.phases || report.phases.some((p) => p.id === source && p.status === 'done');

/** Empareja dos listas de nodos como multiconjuntos, primero por clave exacta y luego por la laxa. */
function matchNodes(finding: Finding, before: readonly FindingNode[], after: readonly FindingNode[]) {
  const pending = [...before];
  const unmatched: FindingNode[] = [];
  const take = (node: FindingNode, key: typeof exactKey) => {
    const target = key(finding, node);
    const index = pending.findIndex((candidate) => key(finding, candidate) === target);
    if (index === -1) return false;
    pending.splice(index, 1);
    return true;
  };
  const leftovers = after.filter((node) => !take(node, exactKey));
  for (const node of leftovers) if (!take(node, looseKey)) unmatched.push(node);
  return { newNodes: unmatched, resolvedNodes: pending };
}

export function compareReports(previous: Comparable, current: Comparable): ReportComparison {
  const before = new Map(previous.findings.map((finding) => [finding.id, finding]));
  const after = new Set(current.findings.map((finding) => finding.id));
  const comparable = (source: Source) => ran(previous, source) && ran(current, source);
  const comparison: ReportComparison = { added: [], resolved: [], changed: [], unchanged: [], incomparable: [] };

  for (const finding of current.findings) {
    if (!comparable(finding.source)) {
      comparison.incomparable.push(finding);
      continue;
    }
    const old = before.get(finding.id);
    if (!old) {
      comparison.added.push(finding);
      continue;
    }
    const { newNodes, resolvedNodes } = matchNodes(finding, old.nodes, finding.nodes);
    if (newNodes.length === 0 && resolvedNodes.length === 0 && old.occurrences === finding.occurrences) {
      comparison.unchanged.push(finding);
    } else {
      comparison.changed.push({ finding, newNodes, resolvedNodes, occurrencesBefore: old.occurrences, occurrencesAfter: finding.occurrences });
    }
  }
  for (const finding of previous.findings) {
    if (!after.has(finding.id) && comparable(finding.source)) comparison.resolved.push(finding);
  }
  return comparison;
}

/** Lo que empeora: reglas nuevas, nodos nuevos o más apariciones, con severidad igual o mayor que el umbral. */
export function regressions(comparison: ReportComparison, threshold: Severity): Finding[] {
  const worse = [
    ...comparison.added,
    ...comparison.changed.filter((c) => c.newNodes.length > 0 || c.occurrencesAfter > c.occurrencesBefore).map((c) => c.finding),
  ];
  return worse.filter((finding) => meetsThreshold(finding.severity, threshold));
}

const pageKey = (report: Pick<Report, 'url' | 'finalUrl'>) => {
  try {
    const url = new URL(report.url);
    url.hash = '';
    return `${url.origin}${url.pathname.replace(/\/+$/, '') || '/'}${url.search}`;
  } catch {
    return report.url;
  }
};

/** Empareja las páginas de dos ejecuciones por URL. Una página sin línea base se compara con un informe vacío. */
export function compareBatches(
  previous: readonly Report[],
  current: readonly Report[],
): Array<{ report: Report; baseline: Report | null; comparison: ReportComparison }> {
  const byUrl = new Map(previous.map((report) => [pageKey(report), report]));
  return current.map((report) => {
    const baseline = byUrl.get(pageKey(report)) ?? null;
    return { report, baseline, comparison: compareReports(baseline ?? { findings: [] }, report) };
  });
}

/** true si los dos informes son de la misma página (misma URL pedida, sin fragmento ni barra final). */
export const samePage = (a: Pick<Report, 'url' | 'finalUrl'>, b: Pick<Report, 'url' | 'finalUrl'>): boolean => pageKey(a) === pageKey(b);

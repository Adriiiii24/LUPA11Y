/** Construcción de hallazgos: un solo sitio decide la forma, los defectos y el orden. */
import { unifiedDiff } from './fixes/diff.ts';
import {
  compareSeverity,
  SOURCES,
  type Evidence,
  type Finding,
  type FindingNode,
  type Fix,
  type Rect,
  type Severity,
  type Source,
  type WcagRef,
} from './schema.ts';

/** Máximo de nodos que se detallan por regla; el resto solo cuenta en `occurrences`. */
export const MAX_NODES_PER_FINDING = 6;

export const EMPTY_EVIDENCE: Evidence = { crop: null, unfocused: null, focused: null };

export interface NodeInput {
  selector: string;
  html: string;
  rect?: Rect | null;
  note?: string | null;
  evidence?: Partial<Evidence>;
  fix?: Fix | null;
}

export interface FindingInput {
  source: Source;
  rule: string;
  title: string;
  detail: string;
  severity: Severity;
  wcag: WcagRef[];
  helpUrl?: string | null;
  confidence?: number | null;
  occurrences?: number;
  nodes: NodeInput[];
}

export function node(input: NodeInput): FindingNode {
  return {
    selector: input.selector,
    html: input.html,
    rect: input.rect ?? null,
    note: input.note ?? null,
    evidence: { ...EMPTY_EVIDENCE, ...input.evidence },
    fix: input.fix ?? null,
  };
}

export function finding(input: FindingInput): Finding {
  const nodes = input.nodes.slice(0, MAX_NODES_PER_FINDING).map(node);
  return {
    id: `${input.source}:${input.rule}`,
    source: input.source,
    rule: input.rule,
    title: input.title,
    detail: input.detail,
    severity: input.severity,
    wcag: input.wcag,
    helpUrl: input.helpUrl ?? null,
    confidence: input.confidence ?? null,
    occurrences: Math.max(input.occurrences ?? input.nodes.length, nodes.length),
    nodes,
  };
}

export function makeFix(input: Omit<Fix, 'diff'>, path: string): Fix {
  return { ...input, diff: unifiedDiff(input.before, input.after, path) };
}

export const wcag = (criterion: string, level: WcagRef['level']): WcagRef => ({ criterion, level });

/** Ordena por severidad y después por fuente, en el mismo orden que las fases. */
export function sortFindings(findings: Finding[]): Finding[] {
  const sourceOrder = (source: Source) => SOURCES.indexOf(source);
  return [...findings].sort(
    (a, b) => compareSeverity(a.severity, b.severity) || sourceOrder(a.source) - sourceOrder(b.source) || b.occurrences - a.occurrences,
  );
}

/**
 * Contrato público de LupA11y. La web, la CLI y el servidor MCP validan contra
 * estos esquemas; ningún consumidor define tipos de informe por su cuenta.
 * Este módulo no importa nada del motor para que el cliente web pueda usarlo.
 */
import { z } from 'zod';

/**
 * 2: fase y fuente `layout` (reflujo y espaciado de texto). Los informes de la versión 1 se leen
 * con `parseReport`, que los migra.
 */
export const SCHEMA_VERSION = 2;

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const Severity = z.enum(SEVERITIES);
export type Severity = z.infer<typeof Severity>;

/** En el orden de las fases: así se ordenan también los hallazgos de igual severidad. */
export const SOURCES = ['axe', 'layout', 'keyboard', 'vision'] as const;
export const Source = z.enum(SOURCES);
export type Source = z.infer<typeof Source>;

export const PHASES = ['load', 'axe', 'layout', 'keyboard', 'vision'] as const;
export const PhaseId = z.enum(PHASES);
export type PhaseId = z.infer<typeof PhaseId>;

export const WcagLevel = z.enum(['A', 'AA', 'AAA']);
export type WcagLevel = z.infer<typeof WcagLevel>;

/** Imagen incrustada. Solo PNG o JPEG: es lo que produce Playwright. */
export const DataUrl = z.string().regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/);

/** Coordenadas de documento en píxeles CSS (deviceScaleFactor = 1). */
export const Rect = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type Rect = z.infer<typeof Rect>;

export const WcagRef = z.object({
  criterion: z.string().regex(/^\d\.\d\.\d{1,2}$/),
  level: WcagLevel.nullable(),
});
export type WcagRef = z.infer<typeof WcagRef>;

export const Fix = z.object({
  summary: z.string(),
  language: z.enum(['html', 'css']),
  before: z.string(),
  after: z.string(),
  /** Diff unificado de `before` a `after`, listo para copiar. */
  diff: z.string(),
  /** Quién propone el arreglo: una regla calculada o el modelo. */
  origin: z.enum(['deterministic', 'model']),
});
export type Fix = z.infer<typeof Fix>;

export const Evidence = z.object({
  /** Recorte del nodo tal y como se ve. */
  crop: DataUrl.nullable(),
  /** Par de recortes para los hallazgos de foco: sin foco y con foco. */
  unfocused: DataUrl.nullable(),
  focused: DataUrl.nullable(),
});
export type Evidence = z.infer<typeof Evidence>;

export const FindingNode = z.object({
  selector: z.string(),
  html: z.string(),
  rect: Rect.nullable(),
  note: z.string().nullable(),
  evidence: Evidence,
  fix: Fix.nullable(),
});
export type FindingNode = z.infer<typeof FindingNode>;

export const Finding = z.object({
  /** Estable dentro de un informe: `${source}:${rule}`. */
  id: z.string(),
  source: Source,
  rule: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: Severity,
  wcag: z.array(WcagRef),
  helpUrl: z.url().nullable(),
  /** Veredicto del modelo (0-1). Solo en hallazgos de visión. */
  confidence: z.number().min(0).max(1).nullable(),
  /** Total de nodos afectados. `nodes` puede venir recortado. */
  occurrences: z.number().int().positive(),
  nodes: z.array(FindingNode).min(1),
});
export type Finding = z.infer<typeof Finding>;

export const FOCUS_STATUSES = ['visible', 'weak', 'invisible', 'unmeasured'] as const;
export const FocusStatus = z.enum(FOCUS_STATUSES);
export type FocusStatus = z.infer<typeof FocusStatus>;

export const TabStop = z.object({
  index: z.number().int().positive(),
  selector: z.string(),
  role: z.string(),
  name: z.string(),
  rect: Rect.nullable(),
  focus: z.object({
    status: FocusStatus,
    /** Píxeles que cambian al menos 3:1 entre foco y sin foco (WCAG 2.4.13). */
    indicatorArea: z.number().nonnegative(),
    /** Área de un perímetro de 2 px del componente: el mínimo de 2.4.13. */
    requiredArea: z.number().nonnegative(),
  }),
  obscured: z.enum(['none', 'partial', 'full']),
});
export type TabStop = z.infer<typeof TabStop>;

export const KEYBOARD_OUTCOMES = ['closed', 'trap', 'modal', 'escaped-loop', 'limit', 'empty'] as const;
export const KeyboardOutcome = z.enum(KEYBOARD_OUTCOMES);
export type KeyboardOutcome = z.infer<typeof KeyboardOutcome>;

export const KeyboardMap = z.object({
  outcome: KeyboardOutcome,
  stops: z.array(TabStop),
  /** Índices de las paradas que forman el bucle, si lo hay. */
  loop: z.array(z.number().int().positive()),
});
export type KeyboardMap = z.infer<typeof KeyboardMap>;

export const PhaseResult = z.object({
  id: PhaseId,
  status: z.enum(['done', 'skipped', 'failed']),
  durationMs: z.number().nonnegative(),
  /** Parte de durationMs que la fase pasó esperando a un servicio externo (la cuota de Gemini), no trabajando. */
  waitedMs: z.number().nonnegative().optional(),
  note: z.string().nullable(),
});
export type PhaseResult = z.infer<typeof PhaseResult>;

const countBy = <T extends readonly [string, ...string[]]>(keys: T) =>
  z.object(Object.fromEntries(keys.map((key) => [key, z.number().int().nonnegative()])) as {
    [K in T[number]]: z.ZodNumber;
  });

export const Screenshot = z.object({
  image: DataUrl,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** true si la página era más alta que el límite de captura. */
  truncated: z.boolean(),
});
export type Screenshot = z.infer<typeof Screenshot>;

export const Viewport = z.object({ width: z.number().int().positive(), height: z.number().int().positive() });

export const Report = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  url: z.url(),
  finalUrl: z.url(),
  title: z.string(),
  lang: z.string().nullable(),
  auditedAt: z.iso.datetime(),
  durationMs: z.number().nonnegative(),
  viewport: Viewport,
  wcagLevel: z.enum(['AA', 'AAA']),
  engines: z.object({
    axe: z.string(),
    browser: z.string(),
    visionModel: z.string().nullable(),
  }),
  phases: z.array(PhaseResult),
  summary: z.object({
    total: z.number().int().nonnegative(),
    bySeverity: countBy(SEVERITIES),
    bySource: countBy(SOURCES),
  }),
  screenshot: Screenshot.nullable(),
  keyboard: KeyboardMap.nullable(),
  findings: z.array(Finding),
});
export type Report = z.infer<typeof Report>;

/**
 * Lee un informe de cualquier versión publicada y lo devuelve en la actual.
 * La 1 no tenía la fuente `layout`: se añade a cero en el resumen.
 */
export function parseReport(input: unknown): Report {
  if (typeof input === 'object' && input !== null && (input as { schemaVersion?: unknown }).schemaVersion === 1) {
    const legacy = input as { summary?: { bySource?: Record<string, number> } };
    return Report.parse({
      ...input,
      schemaVersion: SCHEMA_VERSION,
      summary: { ...legacy.summary, bySource: { layout: 0, ...legacy.summary?.bySource } },
    });
  }
  return Report.parse(input);
}

/** Salida de la CLI cuando se auditan varias páginas en una misma ejecución. */
export const AuditBatch = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: z.iso.datetime(),
  reports: z.array(Report).min(1),
});
export type AuditBatch = z.infer<typeof AuditBatch>;

/** Uno o varios informes, venga de donde venga (un `Report` suelto o un `AuditBatch`). */
export function parseReports(input: unknown): Report[] {
  if (typeof input === 'object' && input !== null && Array.isArray((input as { reports?: unknown }).reports)) {
    return (input as { reports: unknown[] }).reports.map(parseReport);
  }
  return [parseReport(input)];
}

export const ERROR_CODES = [
  'invalid_url',
  'blocked_host',
  'navigation_failed',
  'timeout',
  'aborted',
  'browser_unavailable',
  'rate_limited',
  'internal',
] as const;
export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

/**
 * Eventos de progreso: la consola de la web los pinta tal cual llegan.
 *
 * - `capture`: la página ya está cargada; trae la captura para enseñarla mientras siguen las fases.
 * - `partial`: los hallazgos de una fase recién cerrada. Son provisionales: `result` es la verdad.
 * - `saved`: la web guardó el informe y se puede compartir en `path`.
 */
export const AuditEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('phase'),
    phase: PhaseId,
    state: z.enum(['running', 'done', 'skipped', 'failed']),
    message: z.string(),
  }),
  z.object({ type: z.literal('log'), phase: PhaseId, message: z.string() }),
  z.object({
    type: z.literal('capture'),
    url: z.url(),
    finalUrl: z.url(),
    title: z.string(),
    viewport: Viewport,
    wcagLevel: z.enum(['AA', 'AAA']),
    screenshot: Screenshot,
  }),
  z.object({ type: z.literal('partial'), phase: PhaseId, findings: z.array(Finding), keyboard: KeyboardMap.nullable() }),
  z.object({ type: z.literal('result'), report: Report }),
  z.object({ type: z.literal('saved'), id: z.string().regex(/^[\w-]{8,64}$/), path: z.string().startsWith('/') }),
  z.object({ type: z.literal('error'), code: ErrorCode, message: z.string() }),
]);
export type AuditEvent = z.infer<typeof AuditEvent>;

/** Cuerpo de `POST /api/audit` y entrada de la herramienta MCP. */
export const AuditRequest = z.object({
  url: z.string().trim().min(1).max(2048),
});
export type AuditRequest = z.infer<typeof AuditRequest>;

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const compareSeverity = (a: Severity, b: Severity): number => SEVERITY_RANK[a] - SEVERITY_RANK[b];

/** true si `severity` es igual o más grave que `threshold`. */
export const meetsThreshold = (severity: Severity, threshold: Severity): boolean =>
  SEVERITY_RANK[severity] <= SEVERITY_RANK[threshold];

/** Modelo de vista del observatorio: qué se puede señalar en la captura y cómo se nombra. */
import { SOURCE_LABEL } from '@lupa11y/core/format';
import type { Finding, Rect, Report, Severity, Source, TabStop } from '@lupa11y/core/schema';
import { PALETTE } from '../palette.ts';

export interface Target {
  key: string;
  source: Source;
  rect: Rect;
  selector: string;
  role: string;
  /** Primera línea del tooltip: fase y criterio WCAG con su nivel. */
  band: string;
}

/**
 * La fuente se distingue por el estilo de línea, nunca solo por el color: continua para axe, doble
 * para zoom y espaciado, punteada para el teclado y discontinua para la visión.
 *
 * Las tintas de la captura son fijas y más oscuras que el iris de la interfaz, porque se pintan
 * sobre la página auditada, que puede ser clara: un verde intenso con halo blanco se lee sobre
 * cualquier fondo.
 */
export const SOURCE_LINE: Record<Source, 'solid' | 'double' | 'dotted' | 'dashed'> = { axe: 'solid', layout: 'double', keyboard: 'dotted', vision: 'dashed' };

/** Grosor del contorno: una línea doble necesita al menos 3 px para verse doble. */
export const lineWidth = (source: Source, active: boolean) => (SOURCE_LINE[source] === 'double' ? (active ? 4 : 3) : active ? 2.5 : 1.75);

export const CAPTURE_INK = PALETTE.bg;
/** Cajas de los hallazgos (azul, 5,3:1 sobre la crema de la demo) y su costura con el panel. */
export const CAPTURE_MARK = '#1565c0';
export const CAPTURE_STITCH = PALETTE.azure;
/** Ruta del tabulador (verde, 5,1:1 sobre la crema de la demo) y su resplandor. */
export const CAPTURE_ROUTE = '#0f7a26';
/** Relleno de la caja activa: la tinta de las cajas al 16 %. */
export const CAPTURE_MARK_FILL = 'rgb(21 101 192 / 0.16)';
export const CAPTURE_GLOW = PALETTE.iris;

/**
 * Severidad: una rampa ordinal de un solo tono (validada sobre #09090b: luminosidad monótona,
 * saltos visibles y el extremo bajo a 3,8:1). La gravedad también fija el tamaño de su burbuja.
 */
export const SEVERITY_TONE: Record<Severity, string> = { critical: PALETTE.sevCritical, high: PALETTE.sevHigh, medium: PALETTE.sevMedium, low: PALETTE.sevLow };
export const SEVERITY_SIZE: Record<Severity, number> = { critical: 1, high: 0.8, medium: 0.64, low: 0.52 };

const IMPLICIT_ROLE: Record<string, string> = {
  a: 'link',
  button: 'button',
  img: 'img',
  input: 'textbox',
  select: 'combobox',
  textarea: 'textbox',
  html: 'document',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  section: 'region',
  form: 'form',
  p: 'paragraph',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  strong: 'strong',
};

/** Rol explícito del fragmento o, si no hay, el implícito de su etiqueta. */
export function roleFromHtml(html: string): string {
  const explicit = /^<[^>]*\srole=["']?([\w-]+)/i.exec(html)?.[1];
  if (explicit) return explicit;
  const tag = /^<([a-z][\w-]*)/i.exec(html.trim())?.[1]?.toLowerCase() ?? '';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  return IMPLICIT_ROLE[tag] ?? (tag ? 'generic' : '');
}

export const nodeKey = (finding: Pick<Finding, 'id'>, index: number) => `${finding.id}#${index}`;
export const stopKey = (stop: Pick<TabStop, 'index'>) => `stop:${stop.index}`;

/** Lo que identifica una clave de selección: un nodo de un hallazgo o una parada del tabulador. */
export type ItemRef = { kind: 'node'; findingId: string; index: number } | { kind: 'stop'; index: number };

/** Lee una clave de `nodeKey` o `stopKey`. Los ids de hallazgo (`fuente:regla`) nunca llevan «#». */
export function parseKey(key: string | null): ItemRef | null {
  if (!key) return null;
  if (key.startsWith('stop:')) {
    const index = Number(key.slice(5));
    return Number.isInteger(index) ? { kind: 'stop', index } : null;
  }
  const hash = key.lastIndexOf('#');
  const index = Number(key.slice(hash + 1));
  return hash > 0 && Number.isInteger(index) ? { kind: 'node', findingId: key.slice(0, hash), index } : null;
}

/** El id del hallazgo de una clave, o null si es una parada o no hay clave. */
export const findingIdOf = (key: string | null): string | null => {
  const ref = parseKey(key);
  return ref?.kind === 'node' ? ref.findingId : null;
};

export const wcagLabel = (finding: Finding): string =>
  finding.wcag.length === 0 ? 'Buena práctica' : `WCAG ${finding.wcag.map((w) => `${w.criterion}${w.level ? ` (${w.level})` : ''}`).join(', ')}`;

export const bandFor = (finding: Finding): string => `${SOURCE_LABEL[finding.source]}, ${wcagLabel(finding)}`;

export function targetsFor(report: Report, visible: ReadonlySet<Severity>): Target[] {
  const targets: Target[] = [];
  for (const finding of report.findings) {
    if (!visible.has(finding.severity)) continue;
    finding.nodes.forEach((node, index) => {
      if (!node.rect || node.rect.width < 1 || node.rect.height < 1) return;
      targets.push({
        key: nodeKey(finding, index),
        source: finding.source,
        rect: node.rect,
        selector: node.selector,
        role: roleFromHtml(node.html),
        band: bandFor(finding),
      });
    });
  }
  return targets;
}

export function stopTarget(stop: TabStop): Target | null {
  if (!stop.rect) return null;
  return { key: stopKey(stop), source: 'keyboard', rect: stop.rect, selector: stop.selector, role: stop.role, band: `Teclado, parada ${stop.index}` };
}

export const FOCUS_STATUS_LABEL: Record<TabStop['focus']['status'], string> = {
  visible: 'Foco visible',
  weak: 'Foco débil',
  invisible: 'Foco invisible',
  unmeasured: 'Sin medir',
};

export const formatMs = (ms: number) => `${(ms / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

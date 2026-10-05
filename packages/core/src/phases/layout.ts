/**
 * Fase de zoom y espaciado (determinista): qué pasa cuando alguien amplía la página o separa el texto.
 *
 * - WCAG 1.4.10 (reflujo): a 320 px de ancho, lo mismo que un zoom del 400 % sobre 1280 px, el
 *   contenido no puede obligar a desplazarse en horizontal. Se mide qué contenedores se salen de la
 *   ventana y se agrupan por el bloque que no se adapta, que es donde va el arreglo.
 * - WCAG 1.4.12 (espaciado del texto): con interlineado 1,5, letras a 0,12 em, palabras a 0,16 em y
 *   párrafos a 2 em no se puede perder contenido. Se comparan los textos recortados antes y después:
 *   solo cuenta lo que el espaciado corta, no lo que la página ya recortaba a propósito.
 *
 * Cambia la ventana y añade una hoja de estilos; al terminar, pase lo que pase, deja las dos como estaban.
 */
import type { Page } from 'playwright';
import { captureDocumentClip, padToViewport, toDataUrl } from '../browser/evidence.ts';
import { runtime, type ClippedText, type OverflowGroup } from '../browser/page-runtime.ts';
import { finding, makeFix, wcag, type NodeInput } from '../findings.ts';
import type { Finding, Fix, Rect } from '../schema.ts';

/** Ancho de WCAG 1.4.10. El alto no importa para el desplazamiento horizontal; 640 es un móvil típico. */
export const REFLOW_VIEWPORT = { width: 320, height: 640 } as const;

const MAX_GROUPS = 6;
const MAX_CROPS = 4;

export interface LayoutPhaseResult {
  findings: Finding[];
  /** Ancho del documento a 320 px. */
  scrollWidth: number;
  clipped: number;
}

const settle = async (page: Page, ms = 150) => {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.waitForTimeout(ms);
};

const cssTarget = (selector: string): string => selector.split(' >>> ').at(-1) ?? selector;

function reflowFix(group: OverflowGroup): Fix {
  const target = cssTarget(group.selector);
  const rule =
    group.display.includes('flex') && group.flexWrap === 'nowrap'
      ? { summary: 'Deja que la fila se parta en varias líneas cuando no cabe.', body: 'flex-wrap: wrap;' }
      : group.display.includes('grid')
        ? {
            summary: 'Cambia las columnas fijas por una rejilla fluida: tantas columnas como quepan, y una sola en pantallas estrechas.',
            body: 'grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));',
          }
        : { summary: 'Impide que los hijos sean más anchos que su contenedor y deja que las palabras largas se partan.', body: null };
  const after =
    rule.body === null
      ? `@media (max-width: 40rem) {\n  ${target} > * {\n    max-width: 100%;\n    overflow-wrap: anywhere;\n  }\n}`
      : `@media (max-width: 40rem) {\n  ${target} {\n    ${rule.body}\n  }\n}`;
  return makeFix({ summary: rule.summary, language: 'css', before: '', after, origin: 'deterministic' }, 'styles.css');
}

function spacingFix(clip: ClippedText): Fix {
  const target = cssTarget(clip.selector);
  const lines = [
    ...(clip.lostY > 2 ? ['height: auto;', `min-height: ${Math.round(clip.rect.height)}px;`] : []),
    ...(clip.lostX > 2 ? ['width: auto;', 'max-width: 100%;', 'white-space: normal;'] : []),
  ];
  return makeFix(
    {
      summary:
        'Que la caja crezca con su texto en lugar de recortarlo: sin alto ni ancho fijos, con un mínimo para conservar el diseño.',
      language: 'css',
      before: '',
      after: `${target} {\n${lines.map((line) => `  ${line}`).join('\n')}\n}`,
      origin: 'deterministic',
    },
    'styles.css',
  );
}

/** Recorte que enseña lo que se sale: desde el borde izquierdo hasta donde llega el contenido. */
async function overflowCrop(page: Page, group: OverflowGroup, documentWidth: number, documentHeight: number): Promise<string | null> {
  const clip = padToViewport(
    { x: 0, y: group.rect.y, width: Math.max(group.reach, REFLOW_VIEWPORT.width), height: Math.min(group.rect.height, 360) },
    6,
    { width: documentWidth, height: documentHeight },
  );
  if (!clip) return null;
  return captureDocumentClip(page, clip, 'jpeg').then(
    (image) => toDataUrl(image, 'jpeg'),
    () => null,
  );
}

async function clipCrop(page: Page, rect: Rect, bounds: { width: number; height: number }): Promise<string | null> {
  const clip = padToViewport(rect, 8, bounds);
  if (!clip) return null;
  return captureDocumentClip(page, clip).then(
    (image) => toDataUrl(image, 'png'),
    () => null,
  );
}

const documentSize = (page: Page) =>
  page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));

/** Rects en el diseño normal, para pintar las cajas sobre la captura de 1280 px. */
async function rectsAtNormalLayout(page: Page, selectors: string[]): Promise<Array<Rect | null>> {
  const plain = selectors.map((selector) => (selector.includes(' >>> ') ? '' : selector));
  return runtime.rects(page.mainFrame(), plain);
}

export async function runLayoutPhase(
  page: Page,
  options: { viewport: { width: number; height: number }; signal: AbortSignal; log: (message: string) => void },
): Promise<LayoutPhaseResult> {
  const { viewport, signal, log } = options;
  const frame = page.mainFrame();
  const findings: Finding[] = [];
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });

  // 1.4.10: reflujo a 320 px.
  let reflowNodes: NodeInput[] = [];
  let scrollWidth: number = REFLOW_VIEWPORT.width;
  let scrolls = false;
  let pinnedOnly = false;
  try {
    await page.setViewportSize(REFLOW_VIEWPORT);
    await settle(page, 250);
    signal.throwIfAborted();
    const measurement = await runtime.reflow(frame, MAX_GROUPS);
    scrollWidth = measurement.scrollWidth;
    scrolls = measurement.scrollWidth > measurement.viewportWidth + 1;
    pinnedOnly = !scrolls && measurement.groups.some((g) => g.pinned);
    if (scrolls || pinnedOnly) {
      const size = await documentSize(page);
      const groups = measurement.groups.filter((g) => scrolls || g.pinned);
      const crops: Array<string | null> = [];
      for (const [index, group] of groups.entries()) crops.push(index < MAX_CROPS ? await overflowCrop(page, group, size.width, size.height) : null);
      reflowNodes = groups.map((group, index) => ({
        selector: group.selector,
        html: group.html,
        note: `A ${measurement.viewportWidth} px, ${group.count === 1 ? 'un elemento de este bloque llega' : `${group.count} elementos de este bloque llegan`} hasta ${group.reach} px.${
          group.pinned ? ' Incluye contenido fijo o pegajoso: lo que se sale no se alcanza ni desplazándose.' : ''
        }`,
        evidence: { crop: crops[index] ?? null },
        fix: reflowFix(group),
      }));
    }
    log(
      scrolls
        ? `A 320 px el documento mide ${measurement.scrollWidth} px de ancho: obliga a desplazarse en horizontal.`
        : 'A 320 px el contenido cabe a lo ancho.',
    );
  } finally {
    await page.setViewportSize(viewport);
    await settle(page);
  }

  if (reflowNodes.length > 0) {
    const rects = await rectsAtNormalLayout(page, reflowNodes.map((n) => n.selector));
    reflowNodes = reflowNodes.map((node, i) => ({ ...node, rect: rects[i] ?? null }));
    findings.push(
      finding({
        source: 'layout',
        rule: 'reflow',
        title: scrolls ? 'A 320 px de ancho hay que desplazarse en horizontal' : 'A 320 px de ancho, contenido fijo queda cortado',
        detail: scrolls
          ? 'Con un zoom del 400 % (o en un móvil estrecho), estos bloques no se adaptan al ancho y obligan a leer desplazándose en dos direcciones. Quien amplía la página pierde el hilo de cada línea.'
          : 'Con un zoom del 400 %, parte de una capa fija o pegajosa queda fuera de la ventana y no hay forma de verla.',
        severity: scrolls ? 'high' : 'medium',
        wcag: [wcag('1.4.10', 'AA')],
        nodes: reflowNodes,
      }),
    );
  }

  // 1.4.12: espaciado del texto.
  signal.throwIfAborted();
  let clipped: ClippedText[] = [];
  const crops = new Map<string, string | null>();
  try {
    const before = new Map((await runtime.clipped(frame, 400)).map((c) => [c.selector, c]));
    await runtime.spacing(frame, true);
    await settle(page);
    const after = await runtime.clipped(frame, 400);
    clipped = after.filter((c) => {
      const old = before.get(c.selector);
      return !old || c.lostX > old.lostX + 2 || c.lostY > old.lostY + 2;
    });
    if (clipped.length > 0) {
      const size = await documentSize(page);
      for (const clip of clipped.slice(0, MAX_CROPS)) crops.set(clip.selector, await clipCrop(page, clip.rect, size));
    }
  } finally {
    await runtime.spacing(frame, false).catch(() => null);
    await settle(page, 50);
  }
  log(
    clipped.length > 0
      ? `Con el espaciado de WCAG 1.4.12, ${clipped.length} ${clipped.length === 1 ? 'bloque recorta' : 'bloques recortan'} su texto.`
      : 'Con el espaciado de WCAG 1.4.12 no se recorta ningún texto.',
  );

  if (clipped.length > 0) {
    const rects = await rectsAtNormalLayout(page, clipped.map((c) => c.selector));
    findings.push(
      finding({
        source: 'layout',
        rule: 'text-spacing',
        title: 'Al separar el texto, una caja de tamaño fijo lo recorta',
        detail:
          'Con el interlineado, el espacio entre letras y el espacio entre palabras que exige WCAG 1.4.12 (los que aplican quienes leen con dislexia o baja visión), parte del texto deja de verse porque su caja tiene un alto o un ancho fijos y oculta lo que sobra.',
        severity: 'medium',
        wcag: [wcag('1.4.12', 'AA')],
        nodes: clipped.map((clip, i) => ({
          selector: clip.selector,
          html: clip.html,
          rect: rects[i] ?? clip.rect,
          note: `«${clip.text}»: se dejan de ver ${Math.max(clip.lostX, clip.lostY)} px ${clip.lostX >= clip.lostY ? 'a lo ancho' : 'a lo alto'}.`,
          evidence: { crop: crops.get(clip.selector) ?? null },
          fix: spacingFix(clip),
        })),
      }),
    );
  }

  return { findings, scrollWidth, clipped: clipped.length };
}

/**
 * Fase 2 (agente de teclado): pulsa Tab de verdad y recorre la página como lo haría una persona.
 *
 * En cada parada:
 * 1. Lee el elemento activo, atravesando shadow DOM e iframes.
 * 2. Recorta la zona con foco, hace blur y la recorta sin foco. Chromium conserva el punto de
 *    partida tras el blur, así que el siguiente Tab sigue donde estaba.
 * 3. Compara los dos recortes píxel a píxel (WCAG 2.4.7 y 2.4.13) y comprueba si otra capa tapa el foco (2.4.11).
 *
 * El ciclo se cierra cuando el foco sale del documento. Si vuelve a una parada ya vista sin salir,
 * hay un bucle: dentro de un diálogo modal es lo esperado; fuera, se prueba Escape y Shift+Tab
 * antes de declarar una trampa (2.1.2).
 *
 * Después, los widgets no nativos (`div role="button"`…) se activan con Enter o Espacio para ver
 * si responden (2.1.1). Todo corre en modo de solo lectura: ni envíos ni navegaciones.
 *
 * Cada parada se identifica por el propio nodo (un id que vive en la página), no por su selector:
 * una clase de estado o un hermano nuevo cambian el selector pero no la identidad. El rol y el
 * nombre salen del árbol de accesibilidad de Chromium, es decir, lo que anuncia un lector de pantalla.
 */
import type { CDPSession, ElementHandle, Frame, Page } from 'playwright';
import { captureClip, padToViewport, toDataUrl, type FocusMeasurement, type PixelLab, type ViewportBox } from '../browser/evidence.ts';
import { runtime, type ActiveDescription } from '../browser/page-runtime.ts';
import { finding, makeFix, wcag, type NodeInput } from '../findings.ts';
import { OUTCOME_LABEL } from '../format.ts';
import { toNativeButton } from '../fixes/html.ts';
import type { RequestGuard } from '../network-guard.ts';
import type { Finding, FocusStatus, KeyboardMap, KeyboardOutcome, TabStop } from '../schema.ts';

interface ActiveElement {
  frame: Frame;
  handle: ElementHandle<Element>;
  /** Selectores de los iframes que contienen al elemento, ya con su separador. */
  prefix: string;
}

interface StopRecord {
  stop: TabStop;
  /** Identidad del nodo: prefijo de iframes + id en su documento. */
  identity: string;
  description: ActiveDescription;
  pair: { unfocused: Buffer; focused: Buffer } | null;
  /** El nodo, conservado solo si luego hay que probarlo con Enter o Espacio. */
  handle: ElementHandle<Element> | null;
}

/** Parada con foco débil: la visión decide si una persona lo percibe. */
export interface WeakFocusSample {
  stop: TabStop;
  html: string;
  unfocused: Buffer;
  focused: Buffer;
}

export interface KeyboardPhaseResult {
  map: KeyboardMap;
  findings: Finding[];
  weak: WeakFocusSample[];
}

interface KeyboardOptions {
  maxStops: number;
  level: 'AA' | 'AAA';
  viewport: { width: number; height: number };
  signal: AbortSignal;
  log: (message: string) => void;
}

const ACTIVATABLE_ROLES = new Set(['button', 'link', 'tab', 'menuitem', 'checkbox', 'switch', 'option', 'treeitem', 'radio']);
const MAX_ACTIVATION_TESTS = 6;

const nextFrame = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

/** Elemento activo real, bajando por shadow roots e iframes (también de otro origen). */
async function deepActive(page: Page): Promise<ActiveElement | null> {
  const joinPrefix = (segments: readonly string[]) => segments.map((segment) => `${segment} >>> `).join('');
  const segments: string[] = [];
  let frame = page.mainFrame();
  let container: { frame: Frame; handle: ElementHandle<Element> } | null = null;
  for (let depth = 0; depth < 5; depth += 1) {
    const handle = await frame.evaluateHandle(() => {
      let element = document.activeElement;
      while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
      return element && element !== document.body && element !== document.documentElement ? element : null;
    });
    const element = handle.asElement() as ElementHandle<Element> | null;
    if (!element) {
      await handle.dispose();
      // El iframe tiene el foco pero su documento no marca ningún elemento: la parada es el propio iframe.
      return container ? { ...container, prefix: joinPrefix(segments.slice(0, -1)) } : null;
    }
    const isFrame = await element.evaluate((el) => el.localName === 'iframe' || el.localName === 'frame');
    const child = isFrame ? await element.contentFrame() : null;
    if (!child) return { frame, handle: element, prefix: joinPrefix(segments) };
    segments.push((await runtime.describe(frame, element)).selector);
    container = { frame, handle: element };
    frame = child;
  }
  return null;
}

async function describeActive(active: ActiveElement): Promise<{ selector: string; identity: string; description: ActiveDescription }> {
  const description = await runtime.describe(active.frame, active.handle);
  return { selector: active.prefix + description.selector, identity: `${active.prefix}#${description.uid}`, description };
}

/** El elemento activo real, visto desde el protocolo de depuración (atraviesa shadow roots). */
const DEEP_ACTIVE = `(() => {
  let element = document.activeElement;
  while (element && element.shadowRoot && element.shadowRoot.activeElement) element = element.shadowRoot.activeElement;
  return element === document.body || element === document.documentElement ? null : element;
})()`;

/** Roles internos de Chromium que tienen equivalente ARIA. */
const CHROMIUM_ROLE: Record<string, string> = { DisclosureTriangle: 'button', image: 'img', Iframe: 'iframe', MenuListPopup: 'listbox' };

/**
 * Rol y nombre accesibles del elemento con foco según el árbol de accesibilidad de Chromium.
 * Solo en el documento principal; dentro de iframes vale la aproximación del runtime.
 */
async function accessibleInfo(cdp: CDPSession): Promise<{ role: string | null; name: string } | null> {
  const { result } = await cdp.send('Runtime.evaluate', { expression: DEEP_ACTIVE });
  if (!result.objectId) return null;
  try {
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId: result.objectId, fetchRelatives: false });
    const node = nodes[0];
    if (!node || node.ignored) return null;
    const raw = typeof node.role?.value === 'string' ? node.role.value : '';
    const role = CHROMIUM_ROLE[raw] ?? (/^[a-z]+$/.test(raw) ? raw : null);
    const name = typeof node.name?.value === 'string' ? node.name.value.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    return { role, name };
  } finally {
    await cdp.send('Runtime.releaseObject', { objectId: result.objectId }).catch(() => undefined);
  }
}

/**
 * Caja donde se pinta el foco. Un control oculto visualmente (el radio de 1 px dentro de una
 * <label> estilizada) muestra el foco en su etiqueta: se mide ahí y no en el píxel del input.
 */
async function visualBox(handle: ElementHandle<Element>) {
  const box = await handle.boundingBox();
  if (!box || (box.width >= 4 && box.height >= 4)) return box;
  const proxy = await handle.evaluateHandle((el) => (el as HTMLInputElement).labels?.[0] ?? el.closest('label') ?? el.parentElement);
  const proxyBox = (await proxy.asElement()?.boundingBox()) ?? null;
  await proxy.dispose();
  return proxyBox ?? box;
}

const FOCUS_PAD = 12;

function classifyFocus(indicatorArea: number, changedArea: number, requiredArea: number): FocusStatus {
  if (changedArea < Math.max(4, requiredArea * 0.02)) return 'invisible';
  return indicatorArea >= requiredArea ? 'visible' : 'weak';
}

const UNMEASURED: TabStop['focus'] = { status: 'unmeasured', indicatorArea: 0, requiredArea: 0 };

interface FocusCapture {
  pair: StopRecord['pair'];
  /** La comparación de píxeles corre en el laboratorio mientras el agente sigue tabulando. */
  focus: Promise<TabStop['focus']>;
}

/** true si la caja, con el margen donde se pinta el aro, cabe entera en la ventana. */
const fitsWithPad = (box: ViewportBox, viewport: KeyboardOptions['viewport']) =>
  box.x - FOCUS_PAD >= 0 && box.y - FOCUS_PAD >= 0 && box.x + box.width + FOCUS_PAD <= viewport.width && box.y + box.height + FOCUS_PAD <= viewport.height;

async function captureFocus(
  page: Page,
  active: ActiveElement,
  initialBox: ViewportBox | null,
  lab: PixelLab,
  viewport: KeyboardOptions['viewport'],
): Promise<FocusCapture> {
  let box = initialBox;
  // El navegador desplaza lo justo para enseñar el elemento: pegado al borde, parte del aro queda
  // fuera de la ventana y se mediría menos de lo que hay. Se desplaza la ventana lo necesario para
  // recortar con margen y después se devuelve a su sitio: la parada siguiente tiene que llegar con el
  // mismo desplazamiento que vería una persona (si no, una capa fija dejaría de tapar lo que tapa).
  let restore: readonly [number, number] | null = null;
  if (box && !fitsWithPad(box, viewport) && box.width + 2 * FOCUS_PAD <= viewport.width && box.height + 2 * FOCUS_PAD <= viewport.height) {
    const dx = box.x - FOCUS_PAD < 0 ? box.x - FOCUS_PAD : Math.max(0, box.x + box.width + FOCUS_PAD - viewport.width);
    const dy = box.y - FOCUS_PAD < 0 ? box.y - FOCUS_PAD : Math.max(0, box.y + box.height + FOCUS_PAD - viewport.height);
    restore = await page.evaluate(([x, y]) => {
      const before = [scrollX, scrollY] as const;
      scrollBy(x, y);
      return before;
    }, [dx, dy] as const);
    await nextFrame(page);
    box = await visualBox(active.handle);
  }
  const clip = box ? padToViewport(box, FOCUS_PAD, viewport) : null;
  if (!box || !clip || box.width < 1 || box.height < 1) {
    if (restore) await page.evaluate(([x, y]) => scrollTo(x, y), restore);
    return { pair: null, focus: Promise.resolve(UNMEASURED) };
  }
  const focused = await captureClip(page, clip);
  await runtime.blur(active.frame, active.handle);
  await nextFrame(page);
  const unfocused = await captureClip(page, clip);
  // Devolver el foco: sin esto, el siguiente Tab lo recibiría <body> y los manejadores de
  // teclado del componente (trampas, roving tabindex, menús) nunca llegarían a ejecutarse.
  await active.handle.focus();
  if (restore) await page.evaluate(([x, y]) => scrollTo(x, y), restore);
  // 2.4.13: el indicador debe ocupar al menos un perímetro de 2 px de la parte visible del componente.
  const requiredArea = Math.round(4 * (Math.min(box.width, clip.width) + Math.min(box.height, clip.height)));
  const focus = lab.measureFocus(unfocused, focused).then(
    ({ indicatorArea, changedArea }: FocusMeasurement): TabStop['focus'] => ({
      status: classifyFocus(indicatorArea, changedArea, requiredArea),
      indicatorArea,
      requiredArea,
    }),
    (): TabStop['focus'] => UNMEASURED,
  );
  return { pair: { unfocused, focused }, focus };
}

/** Tras detectar un bucle: ¿sacan el foco Escape o Shift+Tab? */
async function escapesLoop(page: Page, loopMembers: ReadonlySet<string>, loopLength: number): Promise<boolean> {
  const outside = async () => {
    const active = await deepActive(page);
    if (!active) return true;
    const { identity } = await describeActive(active);
    await active.handle.dispose();
    return !loopMembers.has(identity);
  };
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  if (await outside()) return true;
  for (let i = 0; i <= loopLength; i += 1) {
    await page.keyboard.press('Shift+Tab');
    if (await outside()) return true;
  }
  return false;
}

/**
 * Activa un widget no nativo con su tecla y comprueba si algo cambia: DOM, foco o navegación.
 * Usa el mismo nodo que recibió el foco en el recorrido, no lo vuelve a buscar por selector.
 */
async function respondsToKeyboard(page: Page, guard: RequestGuard, record: StopRecord): Promise<boolean> {
  const { handle } = record;
  if (!handle) return true;
  try {
    // Un nodo que ya no está en el documento no se puede probar: no se acusa sin prueba.
    if (!(await handle.evaluate((element) => element.isConnected))) return true;
    await handle.focus();
    const frame = page.mainFrame();
    await runtime.observe(frame);
    guard.takeBlocked();
    const key = ['checkbox', 'switch', 'radio'].includes(record.stop.role) ? 'Space' : 'Enter';
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    const mutations = await runtime.observed(frame);
    const attemptedNavigation = guard.takeBlocked() > 0;
    const active = await deepActive(page);
    const movedFocus = active ? (await describeActive(active)).identity !== record.identity : true;
    await active?.handle.dispose();
    const responded = mutations > 0 || attemptedNavigation || movedFocus;
    if (responded) await page.keyboard.press('Escape');
    return responded;
  } catch {
    return true;
  }
}

const cssTarget = (selector: string): string => selector.split(' >>> ').at(-1) ?? selector;

function focusRingFix(selector: string) {
  const target = `${cssTarget(selector)}:focus-visible`;
  return makeFix(
    {
      summary:
        'Añade un indicador de foco de dos colores (técnica C40 de WCAG): un anillo oscuro con un borde claro por dentro, que contrasta con cualquier fondo.',
      language: 'css',
      before: '',
      after: `${target} {\n  outline: 3px solid #0B0C0C;\n  outline-offset: 2px;\n  box-shadow: 0 0 0 2px #FFFFFF;\n}`,
      origin: 'deterministic',
    },
    'styles.css',
  );
}

const pairEvidence = (pair: StopRecord['pair']) =>
  pair ? { unfocused: toDataUrl(pair.unfocused, 'png'), focused: toDataUrl(pair.focused, 'png') } : {};

const stopNode = (record: StopRecord, extra: Partial<NodeInput> = {}): NodeInput => ({
  selector: record.stop.selector,
  html: record.description.html,
  rect: record.stop.rect,
  evidence: pairEvidence(record.pair),
  ...extra,
});

function buildFindings(records: StopRecord[], outcome: KeyboardOutcome, loop: number[], inoperable: StopRecord[], level: 'AA' | 'AAA'): Finding[] {
  const findings: Finding[] = [];

  if (outcome === 'trap') {
    const members = records.filter((r) => loop.includes(r.stop.index));
    findings.push(
      finding({
        source: 'keyboard',
        rule: 'keyboard-trap',
        title: 'Trampa de teclado: el foco no puede salir de un grupo de elementos',
        detail: `El foco gira entre ${members.length} paradas y ni Tab, ni Shift+Tab, ni Escape lo sacan. Quien navega con teclado queda atrapado.`,
        severity: 'critical',
        wcag: [wcag('2.1.2', 'A')],
        nodes: members.map((r) => stopNode(r)),
      }),
    );
  }

  // Un elemento tapado por otra capa siempre «no cambia»: ya lo cubre focus-obscured.
  const invisible = records.filter((r) => r.stop.focus.status === 'invisible' && r.stop.obscured !== 'full');
  if (invisible.length > 0) {
    findings.push(
      finding({
        source: 'keyboard',
        rule: 'focus-invisible',
        title: 'El foco del teclado no se ve',
        detail:
          'Al recibir el foco con Tab, estos elementos no cambian ni un píxel perceptible respecto al estado sin foco. Quien usa teclado no sabe dónde está.',
        severity: 'high',
        wcag: [wcag('2.4.7', 'AA')],
        nodes: invisible.map((r) =>
          stopNode(r, { note: `Parada ${r.stop.index}: 0 píxeles de indicador medidos.`, fix: focusRingFix(r.stop.selector) }),
        ),
      }),
    );
  }

  const hidden = records.filter((r) => r.stop.obscured === 'full');
  if (hidden.length > 0) {
    findings.push(
      finding({
        source: 'keyboard',
        rule: 'focus-obscured',
        title: 'El elemento con foco queda tapado por otra capa',
        detail: 'Con el foco puesto, otro contenido (una cabecera fija, un banner…) cubre por completo el elemento.',
        severity: 'high',
        wcag: [wcag('2.4.11', 'AA')],
        nodes: hidden.map((r) =>
          stopNode(r, {
            note: `Parada ${r.stop.index}.`,
            fix: makeFix(
              {
                summary: 'Reserva el espacio de las capas fijas al hacer scroll hacia un elemento con foco.',
                language: 'css',
                before: '',
                after: 'html {\n  scroll-padding-block: var(--sticky-header-height, 5rem) 2rem;\n}',
                origin: 'deterministic',
              },
              'styles.css',
            ),
          }),
        ),
      }),
    );
  }

  const partial = records.filter((r) => r.stop.obscured === 'partial');
  if (level === 'AAA' && partial.length > 0) {
    findings.push(
      finding({
        source: 'keyboard',
        rule: 'focus-partially-obscured',
        title: 'El elemento con foco queda tapado en parte',
        detail: 'Una parte del elemento con foco queda bajo otra capa.',
        severity: 'low',
        wcag: [wcag('2.4.12', 'AAA')],
        nodes: partial.map((r) => stopNode(r, { note: `Parada ${r.stop.index}.` })),
      }),
    );
  }

  if (inoperable.length > 0) {
    findings.push(
      finding({
        source: 'keyboard',
        rule: 'keyboard-inoperable',
        title: 'Control que recibe el foco pero no responde al teclado',
        detail:
          'Se pulsó Enter (o Espacio) sobre estos controles no nativos y no cambió nada: ni el DOM, ni el foco, ni se intentó navegar. Seguramente solo escuchan el ratón.',
        severity: 'high',
        wcag: [wcag('2.1.1', 'A')],
        nodes: inoperable.map((r) => {
          const native = r.stop.role === 'button' ? toNativeButton(r.description.html) : null;
          return stopNode(r, {
            note: `Parada ${r.stop.index}, rol «${r.stop.role}».`,
            fix: native
              ? makeFix(
                  {
                    summary: 'Usa un <button> nativo: responde a Enter y a Espacio sin JavaScript extra.',
                    language: 'html',
                    before: r.description.html,
                    after: native,
                    origin: 'deterministic',
                  },
                  'index.html',
                )
              : null,
          });
        }),
      }),
    );
  }

  return findings;
}

/** Veredicto del modelo de visión sobre un foco débil, por índice de parada. */
export interface WeakFocusVerdict {
  perceivable: boolean;
  rationale: string;
  confidence: number;
}

/**
 * Hallazgos de foco débil: hay cambio, pero por debajo del área de 2.4.13.
 * Con veredicto de visión: si no se percibe, falla 2.4.7 (AA); si se percibe, solo 2.4.13 (AAA).
 * Sin visión queda como revisión pendiente de severidad media.
 */
/**
 * Un foco con al menos la mitad del área de 2.4.13 equivale a un contorno de 1 px a 3:1: se ve,
 * aunque no llegue a AAA. Por debajo es ambiguo y lo decide la visión.
 */
export const isAmbiguousFocus = (stop: TabStop): boolean =>
  stop.focus.status === 'weak' && stop.focus.indicatorArea < stop.focus.requiredArea / 2;

export function weakFocusFindings(
  allSamples: readonly WeakFocusSample[],
  verdicts: ReadonlyMap<number, WeakFocusVerdict> | null,
  level: 'AA' | 'AAA',
): Finding[] {
  const samples = allSamples.filter((s) => isAmbiguousFocus(s.stop));
  const nearMisses = allSamples.filter((s) => !isAmbiguousFocus(s.stop));
  const nodeFor = (sample: WeakFocusSample, note: string, fix = true): NodeInput => ({
    selector: sample.stop.selector,
    html: sample.html,
    rect: sample.stop.rect,
    note,
    evidence: { unfocused: toDataUrl(sample.unfocused, 'png'), focused: toDataUrl(sample.focused, 'png') },
    fix: fix ? focusRingFix(sample.stop.selector) : null,
  });
  const measured = (s: WeakFocusSample) =>
    `Parada ${s.stop.index}: ${s.stop.focus.indicatorArea} px de indicador medidos, de ${s.stop.focus.requiredArea} px exigidos por 2.4.13.`;

  const findings: Finding[] = [];
  const appearance = (items: Array<{ sample: WeakFocusSample; note: string }>, confidence: number | null) =>
    finding({
      source: confidence === null ? 'keyboard' : 'vision',
      rule: 'focus-appearance',
      title: 'Foco visible pero por debajo del tamaño de WCAG 2.4.13',
      detail: 'El indicador se percibe, pero no ocupa un perímetro de 2 px con un contraste de 3:1 entre el estado con foco y sin foco.',
      severity: 'low',
      wcag: [wcag('2.4.13', 'AAA')],
      confidence,
      nodes: items.map(({ sample, note }) => nodeFor(sample, note)),
    });

  if (!verdicts) {
    if (level === 'AAA' && nearMisses.length > 0) findings.push(appearance(nearMisses.map((s) => ({ sample: s, note: measured(s) })), null));
    return samples.length === 0
      ? findings
      : [
          ...findings,
          finding({
            source: 'keyboard',
            rule: 'focus-weak',
            title: 'Indicador de foco débil (pendiente de revisión visual)',
            detail:
              'El foco cambia algo la apariencia, pero menos de lo que pide WCAG 2.4.13. Sin la fase de visión no se puede decidir si una persona lo percibe.',
            severity: 'medium',
            wcag: [wcag('2.4.7', 'AA'), wcag('2.4.13', 'AAA')],
            nodes: samples.map((s) => nodeFor(s, measured(s))),
          }),
        ];
  }

  const judged = samples.flatMap((sample) => {
    const verdict = verdicts.get(sample.stop.index);
    return verdict ? [{ sample, verdict }] : [];
  });
  const unseen = judged.filter(({ verdict }) => !verdict.perceivable);
  const seen = judged.filter(({ verdict }) => verdict.perceivable);
  const average = (items: typeof judged) => items.reduce((sum, { verdict }) => sum + verdict.confidence, 0) / items.length;

  if (unseen.length > 0) {
    findings.push(
      finding({
        source: 'vision',
        rule: 'focus-imperceptible',
        title: 'El indicador de foco existe, pero no se distingue a simple vista',
        detail: 'La medición detecta un cambio pequeño y el modelo de visión, comparando los dos estados, concluye que una persona no lo percibiría.',
        severity: 'high',
        wcag: [wcag('2.4.7', 'AA')],
        confidence: average(unseen),
        nodes: unseen.map(({ sample, verdict }) => nodeFor(sample, `${measured(sample)} ${verdict.rationale}`)),
      }),
    );
  }
  const appearing = [
    ...nearMisses.map((sample) => ({ sample, note: measured(sample) })),
    ...seen.map(({ sample, verdict }) => ({ sample, note: `${measured(sample)} ${verdict.rationale}` })),
  ];
  if (level === 'AAA' && appearing.length > 0) findings.push(appearance(appearing, seen.length > 0 ? average(seen) : null));
  return findings;
}

export async function runKeyboardPhase(page: Page, guard: RequestGuard, lab: PixelLab, options: KeyboardOptions): Promise<KeyboardPhaseResult> {
  const { maxStops, viewport, signal, log } = options;
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  guard.setReadOnly(true);
  // Sin sesión CDP (otro navegador, un fallo) el rol y el nombre salen del runtime.
  const cdp = await page.context().newCDPSession(page).catch(() => null);

  const records: StopRecord[] = [];
  const pending: Array<Promise<void>> = [];
  const indexByIdentity = new Map<string, number>();
  let outcome: KeyboardOutcome = 'limit';
  let loop: number[] = [];
  let keptHandles = 0;

  try {
    for (let press = 0; press < maxStops; press += 1) {
      signal.throwIfAborted();
      await page.keyboard.press('Tab');
      await nextFrame(page);
      const active = await deepActive(page);
      if (!active) {
        outcome = records.length > 0 ? 'closed' : 'empty';
        break;
      }
      const { selector, identity, description } = await describeActive(active);
      const seenAt = indexByIdentity.get(identity);
      if (seenAt !== undefined) {
        const members = records.slice(seenAt - 1);
        loop = members.map((r) => r.stop.index);
        await active.handle.dispose();
        if (description.inModal) {
          outcome = 'modal';
          log(`El foco gira dentro de un diálogo modal (${loop.length} paradas): es el comportamiento esperado.`);
        } else {
          const escaped = await escapesLoop(page, new Set(members.map((r) => r.identity)), loop.length);
          outcome = escaped ? 'escaped-loop' : 'trap';
          log(escaped ? 'Bucle de foco del que se sale con Escape o Shift+Tab.' : `Trampa de teclado entre ${loop.length} paradas.`);
        }
        break;
      }

      const inMainFrame = active.frame === page.mainFrame();
      const accessible = cdp && inMainFrame ? await accessibleInfo(cdp).catch(() => null) : null;
      const role = accessible?.role ?? description.role;
      const scroll = await page.evaluate(() => [scrollX, scrollY] as const);
      const box = await visualBox(active.handle);
      const { pair, focus } = await captureFocus(page, active, box, lab, viewport);

      // Solo se conservan los nodos que después se probarán con Enter o Espacio.
      const candidate = !description.native && ACTIVATABLE_ROLES.has(role) && inMainFrame && keptHandles < MAX_ACTIVATION_TESTS;
      if (candidate) keptHandles += 1;
      else await active.handle.dispose();

      const stop: TabStop = {
        index: records.length + 1,
        selector,
        role,
        name: accessible ? accessible.name : description.name,
        rect: box ? { x: box.x + scroll[0], y: box.y + scroll[1], width: box.width, height: box.height } : null,
        focus: UNMEASURED,
        obscured: description.obscured,
      };
      const record: StopRecord = { stop, identity, description, pair, handle: candidate ? active.handle : null };
      records.push(record);
      pending.push(
        focus.then((measured) => {
          record.stop.focus = measured;
        }),
      );
      indexByIdentity.set(identity, stop.index);
      if (stop.index % 10 === 0) log(`${stop.index} paradas recorridas…`);
    }

    await Promise.all(pending);
    const visible = records.filter((r) => r.stop.focus.status === 'visible').length;
    log(`Recorrido: ${records.length} paradas, ${visible} con foco claramente visible; ${OUTCOME_LABEL[outcome]}.`);

    const candidates = records.filter((r) => r.handle !== null);
    const inoperable: StopRecord[] = [];
    for (const record of candidates) {
      signal.throwIfAborted();
      if (!(await respondsToKeyboard(page, guard, record))) inoperable.push(record);
    }
    if (candidates.length > 0) log(`Enter/Espacio sobre ${candidates.length} controles no nativos: ${inoperable.length} no responden.`);

    const weak = records
      .filter((r): r is StopRecord & { pair: NonNullable<StopRecord['pair']> } => r.stop.focus.status === 'weak' && r.pair !== null)
      .map((r) => ({ stop: r.stop, html: r.description.html, unfocused: r.pair.unfocused, focused: r.pair.focused }));

    return {
      map: { outcome, stops: records.map((r) => r.stop), loop },
      findings: buildFindings(records, outcome, loop, inoperable, options.level),
      weak,
    };
  } finally {
    guard.setReadOnly(false);
    // Si el recorrido se cortó, las mediciones pendientes no pueden quedar sin dueño.
    await Promise.allSettled(pending);
    await Promise.all(records.map((r) => r.handle?.dispose().catch(() => undefined)));
    await cdp?.detach().catch(() => undefined);
  }
}

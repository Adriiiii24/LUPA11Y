/**
 * Código que se ejecuta DENTRO de la página auditada.
 *
 * `pageRuntime` se serializa con `Function.prototype.toString` y viaja al navegador, así que
 * tiene que ser autocontenida: nada de imports ni de referencias al ámbito del módulo.
 * Los tipos sí se pueden compartir porque desaparecen al compilar.
 */
import type { Frame, JSHandle } from 'playwright';
import type { Rect } from '../schema.ts';

export interface ActiveDescription {
  /**
   * Identidad del elemento dentro de su documento, estable mientras viva el nodo. El selector puede
   * cambiar (una clase de estado, un hermano nuevo); la identidad no.
   */
  uid: number;
  selector: string;
  role: string;
  name: string;
  native: boolean;
  expanded: string | null;
  inModal: boolean;
  obscured: 'none' | 'partial' | 'full';
  html: string;
}

/** Elemento que desborda el ancho de la ventana a 320 px (WCAG 1.4.10). */
export interface OverflowGroup {
  /** El contenedor cuyo contenido se sale. */
  selector: string;
  html: string;
  /** Hasta dónde llega lo que se sale, en px desde el borde izquierdo. */
  reach: number;
  /** Cuántos hijos directos se salen. */
  count: number;
  /** Algún elemento fijo o pegajoso queda cortado: eso no se arregla ni desplazándose. */
  pinned: boolean;
  display: string;
  flexWrap: string;
  rect: Rect;
}

export interface ReflowMeasurement {
  viewportWidth: number;
  scrollWidth: number;
  groups: OverflowGroup[];
}

/** Elemento cuyo texto queda cortado al aplicar el espaciado de WCAG 1.4.12. */
export interface ClippedText {
  selector: string;
  html: string;
  text: string;
  /** Px de contenido que dejan de verse en horizontal y en vertical. */
  lostX: number;
  lostY: number;
  rect: Rect;
}

export interface ImageInfo {
  selector: string;
  alt: string | null;
  src: string;
  rect: Rect;
  inLink: boolean;
  context: string;
  html: string;
}

export interface PageFacts {
  title: string;
  lang: string | null;
  scrollWidth: number;
  scrollHeight: number;
  scrollX: number;
  scrollY: number;
}

type Command =
  | { op: 'describe'; element: Element }
  | { op: 'rects'; selectors: string[] }
  | { op: 'images'; limit: number; minSide: number }
  | { op: 'facts' }
  | { op: 'blur'; element: Element }
  | { op: 'observe' }
  | { op: 'observed' }
  | { op: 'reflow'; limit: number }
  | { op: 'clipped'; limit: number }
  | { op: 'spacing'; on: boolean };

export function pageRuntime(command: Command): unknown {
  const OBSERVER_KEY = '__lupa11yObserver';
  const IDS_KEY = '__lupa11yIds';
  const SPACING_KEY = '__lupa11ySpacing';
  const escape = (value: string) => CSS.escape(value);

  /** Identidad estable por nodo: un WeakMap en la propia ventana, que muere con el documento. */
  const uidOf = (element: Element): number => {
    let registry = Reflect.get(window, IDS_KEY) as { ids: WeakMap<Element, number>; next: number } | undefined;
    if (!registry) {
      registry = { ids: new WeakMap(), next: 1 };
      Reflect.set(window, IDS_KEY, registry);
    }
    let id = registry.ids.get(element);
    if (id === undefined) {
      id = registry.next;
      registry.next += 1;
      registry.ids.set(element, id);
    }
    return id;
  };
  const collapse = (text: string | null | undefined, max = 80) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const stableClass = (name: string) => /^[a-z][\w-]{1,30}$/i.test(name) && !/\d{3,}/.test(name) && !/^(css|sc|jsx|svelte)-/.test(name);

  const uniqueIn = (root: Document | ShadowRoot, selector: string) => {
    try {
      return root.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };

  const localSelector = (element: Element): string => {
    const root = element.getRootNode() as Document | ShadowRoot;
    if (element.id && uniqueIn(root, `#${escape(element.id)}`)) return `#${escape(element.id)}`;
    const parts: string[] = [];
    let node: Element | null = element;
    while (node && parts.length < 7) {
      if (node.id && uniqueIn(root, `#${escape(node.id)}`)) {
        parts.unshift(`#${escape(node.id)}`);
        break;
      }
      let part = node.localName;
      const classes = [...node.classList].filter(stableClass).slice(0, 2);
      if (classes.length > 0) part += classes.map((name) => `.${escape(name)}`).join('');
      const parent: Element | null = node.parentElement;
      if (parent) {
        const current: Element = node;
        const siblings = [...parent.children].filter((child) => child.localName === current.localName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
      parts.unshift(part);
      if (uniqueIn(root, parts.join(' > '))) return parts.join(' > ');
      node = parent;
    }
    return parts.join(' > ');
  };

  /** Los elementos dentro de shadow DOM se anotan como `host >>> interior`. */
  const selectorFor = (element: Element): string => {
    const root = element.getRootNode();
    const local = localSelector(element);
    return root instanceof ShadowRoot ? `${selectorFor(root.host)} >>> ${local}` : local;
  };

  const implicitRole = (element: Element): string => {
    const tag = element.localName;
    if (tag === 'a') return element.hasAttribute('href') ? 'link' : 'generic';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'iframe') return 'iframe';
    if (tag === 'img') return 'img';
    if (tag === 'input') {
      const type = (element as HTMLInputElement).type;
      if (type === 'checkbox' || type === 'radio') return type;
      if (type === 'range') return 'slider';
      if (type === 'search') return 'searchbox';
      if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
      return 'textbox';
    }
    if ((element as HTMLElement).isContentEditable) return 'textbox';
    return tag;
  };

  const accessibleName = (element: Element): string => {
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '')
        .join(' ');
      if (collapse(text)) return collapse(text);
    }
    const label = element.getAttribute('aria-label');
    if (collapse(label)) return collapse(label);
    const labels = (element as HTMLInputElement).labels;
    if (labels && labels.length > 0) return collapse([...labels].map((l) => l.textContent).join(' '));
    if (element.localName === 'img') return collapse(element.getAttribute('alt'));
    const text = collapse((element as HTMLElement).innerText ?? element.textContent);
    if (text) return text;
    const alt = element.querySelector('img[alt]')?.getAttribute('alt');
    if (collapse(alt)) return collapse(alt);
    return collapse(element.getAttribute('title') ?? element.getAttribute('placeholder'));
  };

  const isNative = (element: Element): boolean =>
    ['a', 'button', 'input', 'select', 'textarea', 'summary', 'iframe', 'audio', 'video'].includes(element.localName);

  const inModal = (element: Element): boolean => {
    let node: Element | null = element;
    while (node) {
      if (
        (node.localName === 'dialog' && (node as HTMLDialogElement).open) ||
        node.getAttribute('aria-modal') === 'true' ||
        ['dialog', 'alertdialog'].includes(node.getAttribute('role') ?? '')
      ) {
        return true;
      }
      const root = node.getRootNode();
      node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
    }
    return false;
  };

  /** Muestra cinco puntos del elemento y comprueba si otra capa lo tapa (WCAG 2.4.11 / 2.4.12). */
  const obscuredBy = (element: Element): ActiveDescription['obscured'] => {
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return 'none';
    const root = element.getRootNode() as Document | ShadowRoot;
    const points: Array<[number, number]> = [
      [0.5, 0.5],
      [0.2, 0.2],
      [0.8, 0.2],
      [0.2, 0.8],
      [0.8, 0.8],
    ].map(([fx, fy]) => [rect.left + rect.width * fx!, rect.top + rect.height * fy!]);
    let tested = 0;
    let covered = 0;
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      tested += 1;
      const hit = root.elementFromPoint(x, y);
      if (hit && hit !== element && !element.contains(hit) && !hit.contains(element)) covered += 1;
    }
    if (tested === 0 || covered === 0) return 'none';
    return covered === tested ? 'full' : 'partial';
  };

  const documentRect = (element: Element): Rect => {
    const r = element.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
  };

  const isRendered = (element: Element): boolean => {
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0;
  };

  const openingTag = (element: Element): string => {
    const html = element.outerHTML;
    const end = html.indexOf('>');
    return (end === -1 ? html : html.slice(0, end + 1)).slice(0, 300);
  };

  /**
   * Contenido que puede necesitar dos dimensiones (tablas de datos, mapas, vídeo, código) o que ya
   * tiene su propio desplazamiento horizontal: WCAG 1.4.10 lo exceptúa.
   */
  const exemptFromReflow = (element: Element): boolean =>
    element.closest('table, pre, code, canvas, video, iframe, object, embed, math, [role="grid"], [role="table"], [role="application"]') !== null ||
    (() => {
      for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth) return true;
      }
      return false;
    })();

  const surroundingText = (element: Element): string => {
    const figure = element.closest('figure');
    const caption = figure?.querySelector('figcaption')?.textContent;
    let heading: string | null = null;
    const headings = [...element.ownerDocument.querySelectorAll('h1, h2, h3')];
    for (const candidate of headings) {
      if (candidate.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) heading = candidate.textContent;
    }
    const block = element.closest('a, figure, li, article, section, p, div');
    return [
      caption ? `Pie de figura: ${collapse(caption, 160)}` : '',
      heading ? `Encabezado anterior: ${collapse(heading, 120)}` : '',
      block ? `Texto del bloque: ${collapse(block.textContent, 240)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  switch (command.op) {
    case 'describe': {
      const { element } = command;
      return {
        uid: uidOf(element),
        selector: selectorFor(element),
        role: element.getAttribute('role') ?? implicitRole(element),
        name: accessibleName(element),
        native: isNative(element),
        expanded: element.getAttribute('aria-expanded'),
        inModal: inModal(element),
        obscured: obscuredBy(element),
        html: element.outerHTML.slice(0, 600),
      } satisfies ActiveDescription;
    }
    case 'rects':
      return command.selectors.map((selector) => {
        try {
          const element = document.querySelector(selector);
          return element ? documentRect(element) : null;
        } catch {
          return null;
        }
      });
    case 'images': {
      const found: ImageInfo[] = [];
      for (const image of document.querySelectorAll('img')) {
        const r = image.getBoundingClientRect();
        const style = getComputedStyle(image);
        if (r.width < command.minSide || r.height < command.minSide) continue;
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        found.push({
          selector: selectorFor(image),
          alt: image.getAttribute('alt'),
          src: (image.currentSrc || image.src).slice(0, 300),
          rect: documentRect(image),
          inLink: image.closest('a[href]') !== null,
          context: surroundingText(image),
          html: image.outerHTML.slice(0, 600),
        });
      }
      return found.sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height).slice(0, command.limit);
    }
    case 'facts':
      return {
        title: collapse(document.title, 200),
        lang: document.documentElement.getAttribute('lang'),
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0),
        scrollX,
        scrollY,
      } satisfies PageFacts;
    case 'blur':
      (command.element as HTMLElement).blur();
      return null;
    case 'observe': {
      const state = { count: 0, observer: null as MutationObserver | null };
      state.observer = new MutationObserver((records) => {
        state.count += records.length;
      });
      state.observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      Reflect.set(window, OBSERVER_KEY, state);
      return null;
    }
    case 'observed': {
      const state = Reflect.get(window, OBSERVER_KEY) as { count: number; observer: MutationObserver | null } | undefined;
      state?.observer?.disconnect();
      Reflect.deleteProperty(window, OBSERVER_KEY);
      return state?.count ?? 0;
    }
    case 'reflow': {
      // Se llama con la ventana ya a 320 px. Un elemento «se sale» si su caja pasa del borde
      // derecho (o del izquierdo). Se agrupan por el contenedor del que se salen: es ahí donde
      // falta el `flex-wrap`, la rejilla fluida o el `max-width`.
      const viewportWidth = document.documentElement.clientWidth;
      const spills = (element: Element) => {
        const r = element.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.right > viewportWidth + 1 || r.left < -1);
      };
      const offenders = new Set<Element>();
      let scanned = 0;
      for (const element of document.body?.querySelectorAll('*') ?? []) {
        if (scanned++ > 6000) break;
        if (element instanceof SVGElement && element.localName !== 'svg') continue;
        if (!spills(element) || !isRendered(element) || exemptFromReflow(element)) continue;
        offenders.add(element);
      }
      const groups = new Map<Element, OverflowGroup>();
      for (const element of offenders) {
        // Solo las raíces: si el padre también se sale, el problema está más arriba.
        if (element.parentElement && offenders.has(element.parentElement)) continue;
        const container = element.parentElement ?? element;
        const r = element.getBoundingClientRect();
        const position = getComputedStyle(element).position;
        const group = groups.get(container);
        if (group) {
          group.reach = Math.max(group.reach, Math.round(r.right));
          group.count += 1;
          group.pinned ||= position === 'fixed' || position === 'sticky';
          continue;
        }
        const style = getComputedStyle(container);
        groups.set(container, {
          selector: selectorFor(container),
          html: openingTag(container),
          reach: Math.round(r.right),
          count: 1,
          pinned: position === 'fixed' || position === 'sticky',
          display: style.display,
          flexWrap: style.flexWrap,
          rect: documentRect(container),
        });
      }
      return {
        viewportWidth,
        scrollWidth: document.documentElement.scrollWidth,
        groups: [...groups.values()].sort((a, b) => b.reach - a.reach).slice(0, command.limit),
      } satisfies ReflowMeasurement;
    }
    case 'clipped': {
      // Texto que un contenedor con `overflow: hidden` o `clip` deja de mostrar. Se mide el propio
      // texto (sus recuadros de línea), no el contenido en general: que una imagen decorativa se salga
      // no es pérdida de texto. Lo que se puede desplazar (auto, scroll) no se pierde, y cada texto
      // cuenta solo para el contenedor recortado más cercano. Los ocultos visualmente (1 px) se ignoran.
      const hides = (value: string) => value === 'hidden' || value === 'clip';
      const styles = new Map<Element, CSSStyleDeclaration>();
      const styleOf = (element: Element) => {
        let style = styles.get(element);
        if (!style) {
          style = getComputedStyle(element);
          styles.set(element, style);
        }
        return style;
      };
      const confines = (element: Element) => {
        const { overflowX, overflowY } = styleOf(element);
        return overflowX !== 'visible' || overflowY !== 'visible';
      };
      const found: ClippedText[] = [];
      for (const element of document.body?.querySelectorAll('*') ?? []) {
        if (found.length >= command.limit) break;
        if (!(element instanceof HTMLElement)) continue;
        const style = styleOf(element);
        const clipsX = hides(style.overflowX);
        const clipsY = hides(style.overflowY);
        if (!clipsX && !clipsY) continue;
        if (element.clientWidth <= 2 || element.clientHeight <= 2 || !isRendered(element)) continue;
        const box = element.getBoundingClientRect();
        const left = box.left + element.clientLeft;
        const top = box.top + element.clientTop;
        const right = left + element.clientWidth;
        const bottom = top + element.clientHeight;
        let lostX = 0;
        let lostY = 0;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim() || !node.parentElement || !isRendered(node.parentElement)) continue;
          let owner: Element | null = node.parentElement;
          while (owner && owner !== element && !confines(owner)) owner = owner.parentElement;
          if (owner !== element) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width === 0 || rect.height === 0) continue;
            if (clipsX) lostX = Math.max(lostX, rect.right - right, left - rect.left);
            if (clipsY) lostY = Math.max(lostY, rect.bottom - bottom, top - rect.top);
          }
        }
        lostX = Math.round(lostX);
        lostY = Math.round(lostY);
        if (Math.max(lostX, lostY) <= 2) continue;
        found.push({
          selector: selectorFor(element),
          html: element.outerHTML.slice(0, 600),
          text: collapse(element.innerText, 120),
          lostX,
          lostY,
          rect: documentRect(element),
        });
      }
      return found;
    }
    case 'spacing': {
      // El espaciado de WCAG 1.4.12 (el de su marcador de prueba), como hoja adoptada: no depende
      // de la CSP de la página y se retira sin dejar rastro.
      const current = Reflect.get(document, SPACING_KEY) as CSSStyleSheet | undefined;
      if (current) {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== current);
        Reflect.deleteProperty(document, SPACING_KEY);
      }
      if (command.on) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(
          '*, *::before, *::after { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
        );
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
        Reflect.set(document, SPACING_KEY, sheet);
      }
      return null;
    }
  }
}

/**
 * Envoltorios tipados. Los tipos de `evaluate` de Playwright no aceptan una unión discriminada
 * con handles dentro, así que la conversión vive solo aquí: cada envoltorio construye un
 * comando válido y declara el tipo que devuelve.
 */
type Evaluate = (fn: (command: Command) => unknown, arg: unknown) => Promise<unknown>;

const call = <R>(frame: Frame, command: Command | { op: Command['op']; element: JSHandle<Element> }): Promise<R> =>
  (frame.evaluate as unknown as Evaluate).call(frame, pageRuntime, command) as Promise<R>;

export const runtime = {
  describe: (frame: Frame, element: JSHandle<Element>) => call<ActiveDescription>(frame, { op: 'describe', element }),
  rects: (frame: Frame, selectors: string[]) => call<Array<Rect | null>>(frame, { op: 'rects', selectors }),
  images: (frame: Frame, limit: number, minSide: number) => call<ImageInfo[]>(frame, { op: 'images', limit, minSide }),
  facts: (frame: Frame) => call<PageFacts>(frame, { op: 'facts' }),
  blur: (frame: Frame, element: JSHandle<Element>) => call<null>(frame, { op: 'blur', element }),
  observe: (frame: Frame) => call<null>(frame, { op: 'observe' }),
  observed: (frame: Frame) => call<number>(frame, { op: 'observed' }),
  reflow: (frame: Frame, limit: number) => call<ReflowMeasurement>(frame, { op: 'reflow', limit }),
  clipped: (frame: Frame, limit: number) => call<ClippedText[]>(frame, { op: 'clipped', limit }),
  spacing: (frame: Frame, on: boolean) => call<null>(frame, { op: 'spacing', on }),
};

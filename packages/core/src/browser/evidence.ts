/**
 * Capturas y medición del indicador de foco.
 *
 * La comparación de píxeles se hace en una página en blanco de un contexto aparte con un canvas.
 * Así no hace falta ninguna librería de imágenes y la CSP de la web auditada no interfiere.
 */
import type { Browser, BrowserContext, Page } from 'playwright';

export interface ViewportBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const toDataUrl = (buffer: Buffer, type: 'png' | 'jpeg'): string => `data:image/${type};base64,${buffer.toString('base64')}`;

/**
 * Amplía la caja `pad` px por cada lado y la recorta a unos límites (el viewport o el documento).
 * null si no queda nada visible.
 */
export function padToViewport(box: ViewportBox, pad: number, bounds: { width: number; height: number }): ViewportBox | null {
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const right = Math.min(bounds.width, Math.ceil(box.x + box.width + pad));
  const bottom = Math.min(bounds.height, Math.ceil(box.y + box.height + pad));
  const width = right - x;
  const height = bottom - y;
  return width >= 2 && height >= 2 ? { x, y, width, height } : null;
}

export async function captureClip(page: Page, clip: ViewportBox): Promise<Buffer> {
  return page.screenshot({ clip, type: 'png', animations: 'disabled', caret: 'hide', timeout: 5_000 });
}

/**
 * Oculta, mientras dura `task`, las capas fijas (barras promocionales, avisos de cookies…) que no
 * contienen ninguno de los elementos que se van a recortar. En una captura de documento se pintan
 * en su sitio de la primera ventana, encima de lo que haya debajo: sin esto, un recorte del contenido
 * saldría tapado y el modelo describiría la capa en vez de la imagen. Al terminar todo queda como estaba.
 */
export async function withoutFixedOverlays<T>(page: Page, keep: readonly string[], task: () => Promise<T>): Promise<T> {
  const hidden = await page
    .evaluate((selectors) => {
      const targets = selectors.flatMap((selector) => {
        try {
          return [...document.querySelectorAll(selector)];
        } catch {
          return [];
        }
      });
      let count = 0;
      for (const element of document.body?.querySelectorAll('*') ?? []) {
        if (!(element instanceof HTMLElement) || getComputedStyle(element).position !== 'fixed') continue;
        if (targets.some((target) => element.contains(target))) continue;
        element.dataset['lupa11yHidden'] = `${element.style.getPropertyValue('visibility')}|${element.style.getPropertyPriority('visibility')}`;
        element.style.setProperty('visibility', 'hidden', 'important');
        count += 1;
      }
      return count;
    }, [...keep])
    .catch(() => 0);
  try {
    return await task();
  } finally {
    if (hidden > 0) {
      await page
        .evaluate(() => {
          for (const element of document.querySelectorAll<HTMLElement>('[data-lupa11y-hidden]')) {
            const [value = '', priority = ''] = (element.dataset['lupa11yHidden'] ?? '|').split('|');
            if (value) element.style.setProperty('visibility', value, priority);
            else element.style.removeProperty('visibility');
            delete element.dataset['lupa11yHidden'];
          }
        })
        .catch(() => undefined);
    }
  }
}

/**
 * Recorte en coordenadas de documento, sin desplazar la página: Chromium captura más allá de la
 * ventana. Al no hacer scroll, una cabecera fija no tapa el elemento recortado.
 */
export async function captureDocumentClip(page: Page, clip: ViewportBox, type: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
  return page.screenshot({
    fullPage: true,
    clip,
    type,
    ...(type === 'jpeg' ? { quality: 80 } : {}),
    animations: 'disabled',
    caret: 'hide',
    timeout: 5_000,
  });
}

export interface FocusMeasurement {
  /** Píxeles con un contraste de 3:1 o más entre el estado con foco y sin foco. */
  indicatorArea: number;
  /** Píxeles que cambian de forma perceptible, sea cual sea el contraste. */
  changedArea: number;
}

/**
 * Compara dos recortes del mismo tamaño. Vive en su propio contexto: su página en blanco
 * no pasa por la política de red y no altera el foco de la página auditada.
 */
export class PixelLab {
  readonly #context: BrowserContext;
  readonly #page: Page;

  private constructor(context: BrowserContext, page: Page) {
    this.#context = context;
    this.#page = page;
  }

  static async open(browser: Browser): Promise<PixelLab> {
    const context = await browser.newContext({ javaScriptEnabled: true, offline: true });
    const page = await context.newPage();
    return new PixelLab(context, page);
  }

  async measureFocus(unfocused: Buffer, focused: Buffer): Promise<FocusMeasurement> {
    return this.#page.evaluate(
      async ({ a, b }) => {
        const load = async (src: string) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          return image;
        };
        const [first, second] = await Promise.all([load(a), load(b)]);
        const width = Math.min(first.naturalWidth, second.naturalWidth);
        const height = Math.min(first.naturalHeight, second.naturalHeight);
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return { indicatorArea: 0, changedArea: 0 };
        context.drawImage(first, 0, 0);
        const pa = context.getImageData(0, 0, width, height).data;
        context.clearRect(0, 0, width, height);
        context.drawImage(second, 0, 0);
        const pb = context.getImageData(0, 0, width, height).data;

        const linear = new Float64Array(256);
        for (let v = 0; v < 256; v += 1) {
          const s = v / 255;
          linear[v] = s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        }
        const luminance = (d: Uint8ClampedArray, i: number) =>
          0.2126 * linear[d[i]!]! + 0.7152 * linear[d[i + 1]!]! + 0.0722 * linear[d[i + 2]!]!;

        let indicatorArea = 0;
        let changedArea = 0;
        for (let i = 0; i < pa.length; i += 4) {
          const delta = Math.abs(pa[i]! - pb[i]!) + Math.abs(pa[i + 1]! - pb[i + 1]!) + Math.abs(pa[i + 2]! - pb[i + 2]!);
          if (delta <= 24) continue;
          changedArea += 1;
          const la = luminance(pa, i);
          const lb = luminance(pb, i);
          if ((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05) >= 3) indicatorArea += 1;
        }
        return { indicatorArea, changedArea };
      },
      { a: toDataUrl(unfocused, 'png'), b: toDataUrl(focused, 'png') },
    );
  }

  async close(): Promise<void> {
    await this.#context.close();
  }
}

/**
 * Contraste WCAG y corrección de color que conserva el tono de marca.
 * El ajuste se hace en OKLCH: se mueve la luminosidad y, si el color sale de sRGB,
 * se reduce el croma lo justo para volver a la gama.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

export function parseHex(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, '');
  if (!/^(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(hex)) return null;
  const full = hex.length <= 4 ? [...hex].map((ch) => ch + ch).join('') : hex;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

const toLinear = (channel: number): number => {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (value: number): number => {
  const s = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return s * 255;
};

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toOklch(rgb: Rgb): Oklch {
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

/** Devuelve el color en sRGB lineal sin recortar, para poder comprobar la gama. */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const EPSILON = 1e-4;
const inGamut = (channels: readonly number[]): boolean => channels.every((v) => v >= -EPSILON && v <= 1 + EPSILON);

/** Color sRGB para una luminosidad y tono dados, con el mayor croma posible sin pasar de `maxChroma`. */
function mapToGamut(l: number, maxChroma: number, h: number): Rgb {
  let lo = 0;
  let hi = maxChroma;
  if (!inGamut(oklchToLinear({ l, c: hi, h }))) {
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ l, c: mid, h }))) lo = mid;
      else hi = mid;
    }
    hi = lo;
  }
  const [r, g, b] = oklchToLinear({ l, c: hi, h }).map((v) => Math.min(255, Math.max(0, fromLinear(Math.min(1, Math.max(0, v)))))) as [
    number,
    number,
    number,
  ];
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

/**
 * Busca el color más parecido a `fg` (mismo tono y el menor cambio de luminosidad)
 * que alcance `target` contra `bg`. Prueba a oscurecer y a aclarar y se queda con el menor salto.
 * Devuelve null si ni el negro ni el blanco llegan al objetivo.
 */
export function adjustForContrast(fg: Rgb, bg: Rgb, target: number): Rgb | null {
  if (contrastRatio(fg, bg) >= target) return fg;
  const origin = toOklch(fg);
  const candidates: { color: Rgb; shift: number }[] = [];

  for (const bound of [0, 1]) {
    const endpoint = mapToGamut(bound, origin.c, origin.h);
    if (contrastRatio(endpoint, bg) < target) continue;
    let near = origin.l;
    let far = bound;
    for (let i = 0; i < 32; i += 1) {
      const mid = (near + far) / 2;
      if (contrastRatio(mapToGamut(mid, origin.c, origin.h), bg) >= target) far = mid;
      else near = mid;
    }
    // Tras redondear a 8 bits el ratio puede caer justo por debajo: se empuja un poco más.
    let l = far;
    let color = mapToGamut(l, origin.c, origin.h);
    const step = bound === 0 ? -0.002 : 0.002;
    while (contrastRatio(color, bg) < target && l >= 0 && l <= 1) {
      l += step;
      color = mapToGamut(Math.min(1, Math.max(0, l)), origin.c, origin.h);
    }
    candidates.push({ color, shift: Math.abs(l - origin.l) });
  }

  candidates.sort((a, b) => a.shift - b.shift);
  return candidates[0]?.color ?? null;
}

/** «4.5:1» → 4.5 */
export function parseRatio(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'string') return null;
  const value = Number.parseFloat(input);
  return Number.isFinite(value) ? value : null;
}

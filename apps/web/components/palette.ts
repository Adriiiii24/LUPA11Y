/**
 * La paleta de Fluid Optics para lo que no puede ser una clase de Tailwind: estilos en línea,
 * atributos de SVG, degradados y la tarjeta de Open Graph. Las clases leen las variables de
 * `app/globals.css`; un test comprueba que las dos fuentes dicen lo mismo, así no se separan cuando
 * la paleta vuelva a cambiar.
 *
 * El blanco y el negro con transparencia (brillos y sombras) no son paleta: son luz y se escriben tal cual.
 */
export const PALETTE = {
  bg: '#09090b',
  raised: '#111113',
  surface: '#18181b',
  surface2: '#1f1f23',
  text: '#fafafa',
  textMuted: '#b4b4bc',
  /** El azul del logo: lo interactivo y lo que se mide. */
  azure: '#56c2f2',
  azureStrong: '#bfeaff',
  azureDeep: '#3b8fc4',
  /** El verde del logo: progreso y gravedad. */
  iris: '#6be35a',
  irisStrong: '#c8f7b6',
  sevLow: '#2f8a3c',
  sevMedium: '#45b34f',
  sevHigh: '#6be35a',
  sevCritical: '#c8f7b6',
  /** Sombras de los tintes, para el fondo de las lentes. */
  azureShade: '#2878aa',
  irisShade: '#45b34f',
  teal: '#4ed2b4',
  tealShade: '#1f8f7a',
  /** La pupila de la lente y su borde. */
  pupil: '#0b0d12',
  pupilRim: '#0c2c34',
} as const;

export type PaletteColor = keyof typeof PALETTE;

/** Los canales de un color de la paleta, «r g b». */
export const channels = (color: PaletteColor): string =>
  [1, 3, 5].map((i) => Number.parseInt(PALETTE[color].slice(i, i + 2), 16)).join(' ');

/** El color con transparencia, `rgb(r g b / a)`: lo mismo que escribirlo a mano, pero desde la paleta. */
export const tint = (color: PaletteColor, alpha: number): string => `rgb(${channels(color)} / ${alpha})`;

/** La sintaxis con comas, para el renderizador de la tarjeta de Open Graph, que no lee la moderna. */
export const rgba = (color: PaletteColor, alpha: number): string => `rgba(${channels(color).replaceAll(' ', ',')},${alpha})`;

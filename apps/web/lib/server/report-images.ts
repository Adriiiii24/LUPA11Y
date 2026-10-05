/**
 * Las imágenes de un informe, fuera del informe.
 *
 * El contrato guarda capturas y recortes como data URL: es autosuficiente, pero una página que pasa
 * el informe entero a un componente de cliente lo serializa en el HTML (la landing llegó a pesar
 * 780 KB). Aquí cada data URL se sustituye por una URL corta con el hash de su contenido, que una
 * ruta sirve aparte, cacheable para siempre y solo cuando el navegador la pide.
 */
import { createHash } from 'node:crypto';
import type { Report } from '@lupa11y/core/schema';

const DATA_URL = /^data:(image\/(?:png|jpeg));base64,(.+)$/;

/** Clave estable de una imagen: hash de su contenido más la extensión. */
export const imageKey = (dataUrl: string): string =>
  `${createHash('sha256').update(dataUrl).digest('base64url').slice(0, 20)}.${dataUrl.startsWith('data:image/png') ? 'png' : 'jpg'}`;

export const KEY_PATTERN = /^[\w-]{20}\.(png|jpg)$/;

/** Recorre todas las imágenes de un informe. */
function* images(report: Report): Generator<string> {
  if (report.screenshot) yield report.screenshot.image;
  for (const finding of report.findings) {
    for (const node of finding.nodes) {
      const { crop, unfocused, focused } = node.evidence;
      if (crop) yield crop;
      if (unfocused) yield unfocused;
      if (focused) yield focused;
    }
  }
}

/** Índice clave → data URL, para servir cada imagen por su clave. */
export function imageIndex(report: Report): Map<string, string> {
  const index = new Map<string, string>();
  for (const image of images(report)) index.set(imageKey(image), image);
  return index;
}

/**
 * Copia del informe con cada imagen apuntando a `${base}/${clave}`. El resultado ya no cumple el
 * esquema (que exige data URL): es solo para pintarlo, nunca para validarlo ni para exportarlo.
 */
export function externalizeImages(report: Report, base: string): Report {
  const swap = <T extends string | null>(value: T): T => (value?.startsWith('data:') ? (`${base}/${imageKey(value)}` as T) : value);
  return {
    ...report,
    screenshot: report.screenshot ? { ...report.screenshot, image: swap(report.screenshot.image) } : null,
    findings: report.findings.map((finding) => ({
      ...finding,
      nodes: finding.nodes.map((node) => ({
        ...node,
        evidence: { crop: swap(node.evidence.crop), unfocused: swap(node.evidence.unfocused), focused: swap(node.evidence.focused) },
      })),
    })),
  };
}

/** Respuesta HTTP con la imagen decodificada. `immutable`: la clave cambia si cambia el contenido. */
export function imageResponse(dataUrl: string | undefined): Response {
  const match = dataUrl ? DATA_URL.exec(dataUrl) : null;
  if (!match?.[1] || !match[2]) return new Response('No encontrada', { status: 404 });
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'content-type': match[1],
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

/**
 * Salidas del informe desde el navegador: JSON (el contrato, para `--baseline` o para otra
 * herramienta), SARIF (escaneo de código de GitHub) y Markdown (una issue o un PR).
 */
import { toMarkdown, withoutImages } from '@lupa11y/core/format';
import { toSarif } from '@lupa11y/core/sarif';
import type { Report } from '@lupa11y/core/schema';

const fileStem = (report: Report) => {
  let host = 'informe';
  try {
    host = new URL(report.finalUrl).host.replace(/[^\w.-]+/g, '-');
  } catch {
    // URL rara: se queda el nombre genérico.
  }
  return `lupa11y-${host}-${report.auditedAt.slice(0, 10)}`;
};

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Se libera después: algunos navegadores leen el enlace de forma asíncrona.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** true si las imágenes van dentro (data URL); en la muestra y los guardados son URL del servidor. */
const inlineImages = (report: Report) => report.screenshot === null || report.screenshot.image.startsWith('data:');

export function downloadJson(report: Report) {
  // Sin las imágenes inline, el JSON solo cumple el contrato si se quitan.
  const contract = inlineImages(report) ? report : withoutImages(report);
  download(`${fileStem(report)}.json`, JSON.stringify(contract, null, 2), 'application/json');
}

export function downloadSarif(report: Report) {
  download(`${fileStem(report)}.sarif`, JSON.stringify(toSarif([report], { informationUri: 'https://github.com/Adriiiii24/LupA11y' }), null, 2), 'application/sarif+json');
}

export const markdownOf = (report: Report) => toMarkdown(report);

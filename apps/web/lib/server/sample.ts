/**
 * La auditoría de muestra (`data/sample-report.json`, generada con `npm run sample`): se lee y se
 * valida una vez por proceso. La landing recibe la versión con las imágenes fuera, servidas por
 * `app/sample/[key]/route.ts`. Su URL pasa a ser la `/demo` de este despliegue: la página es la
 * misma, solo cambia dónde se sirvió al generarla.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseReport, type Report } from '@lupa11y/core/schema';
import { siteUrl } from '../site';
import { externalizeImages, imageIndex } from './report-images';

export const SAMPLE_IMAGE_BASE = '/sample';

let cached: { report: Report; light: Report; index: Map<string, string> } | null = null;

function load() {
  if (!cached) {
    const demo = new URL('/demo', siteUrl()).href;
    const report = { ...parseReport(JSON.parse(readFileSync(join(process.cwd(), 'data/sample-report.json'), 'utf8'))), url: demo, finalUrl: demo };
    cached = { report, light: externalizeImages(report, SAMPLE_IMAGE_BASE), index: imageIndex(report) };
  }
  return cached;
}

/** El informe completo y validado, con sus data URL (para el Markdown, los recuentos…). */
export const sampleReport = (): Report => load().report;

/** El mismo informe con las imágenes como URL cortas: lo que viaja al cliente. */
export const lightSampleReport = (): Report => load().light;

export const sampleImages = (): Map<string, string> => load().index;

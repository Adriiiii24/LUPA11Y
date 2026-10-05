/**
 * Fase 1 (determinista): axe-core dentro de la página, con los mensajes en español.
 * Cada violación se convierte en un hallazgo con nodos, recortes y, en contraste de color,
 * un arreglo calculado que conserva el tono original.
 */
import { AxeBuilder } from '@axe-core/playwright';
import axe from 'axe-core';
import esLocale from 'axe-core/locales/es.json' with { type: 'json' };
import type { NodeResult, Result } from 'axe-core';
import type { Page } from 'playwright';
import { captureDocumentClip, padToViewport, toDataUrl, withoutFixedOverlays } from '../browser/evidence.ts';
import { runtime } from '../browser/page-runtime.ts';
import { finding, makeFix, MAX_NODES_PER_FINDING, wcag, type NodeInput } from '../findings.ts';
import { adjustForContrast, contrastRatio, parseHex, parseRatio, toHex } from '../fixes/color.ts';
import type { Finding, Fix, Rect, Severity, WcagLevel, WcagRef } from '../schema.ts';

const AXE_SOURCE = `${axe.source}\n;axe.configure({ locale: ${JSON.stringify(esLocale)} });`;

export const AXE_VERSION = axe.version;

const TAGS: Record<'AA' | 'AAA', string[]> = {
  AA: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  AAA: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa', 'wcag22aa', 'best-practice'],
};

/** Reglas de imágenes: su arreglo necesita ver la imagen, así que lo propone la fase de visión. */
export const IMAGE_RULES = new Set(['image-alt', 'input-image-alt', 'role-img-alt', 'svg-img-alt', 'area-alt', 'object-alt']);

const MAX_CROPS = 24;

const IMPACT_TO_SEVERITY: Record<string, Severity> = { critical: 'critical', serious: 'high', moderate: 'medium', minor: 'low' };

/** «wcag143» → 1.4.3 y el nivel sale de etiquetas como «wcag21aa». */
export function wcagFromTags(tags: readonly string[]): WcagRef[] {
  const level = tags
    .map((tag) => /^wcag2\d?(a{1,3})$/.exec(tag)?.[1])
    .find((match): match is string => match !== undefined)
    ?.toUpperCase() as WcagLevel | undefined;
  return tags
    .map((tag) => /^wcag(\d)(\d)(\d{1,2})$/.exec(tag))
    .filter((match): match is RegExpExecArray => match !== null)
    .map(([, principle, guideline, criterion]) => wcag(`${principle}.${guideline}.${criterion}`, level ?? null));
}

const selectorOf = (target: NodeResult['target']): string =>
  target.map((part) => (Array.isArray(part) ? part.join(' >>> ') : String(part))).join(' >>> ');

const isTopLevel = (target: NodeResult['target']): boolean => target.length === 1 && typeof target[0] === 'string';

function contrastFix(node: NodeResult, selector: string): Fix | null {
  const check = node.any.find((c) => c.id === 'color-contrast' || c.id === 'color-contrast-enhanced');
  const data = check?.data as Record<string, unknown> | undefined;
  const fg = typeof data?.['fgColor'] === 'string' ? parseHex(data['fgColor']) : null;
  const bg = typeof data?.['bgColor'] === 'string' ? parseHex(data['bgColor']) : null;
  const target = parseRatio(data?.['expectedContrastRatio']);
  if (!fg || !bg || !target) return null;
  const fixed = adjustForContrast(fg, bg, target);
  if (!fixed) return null;
  const before = `${selector} {\n  color: ${toHex(fg)};\n}`;
  const after = `${selector} {\n  color: ${toHex(fixed)};\n}`;
  return makeFix(
    {
      summary: `Sube el contraste de ${contrastRatio(fg, bg).toFixed(2)}:1 a ${contrastRatio(fixed, bg).toFixed(2)}:1 (objetivo ${target}:1) cambiando solo la luminosidad: el tono se conserva.`,
      language: 'css',
      before,
      after,
      origin: 'deterministic',
    },
    'styles.css',
  );
}

export interface AxePhaseResult {
  findings: Finding[];
  version: string;
}

export async function runAxePhase(
  page: Page,
  level: 'AA' | 'AAA',
  sizes: { viewport: { width: number; height: number }; document: { width: number; height: number } },
  log: (message: string) => void,
): Promise<AxePhaseResult> {
  const results = await new AxeBuilder({ page, axeSource: AXE_SOURCE }).withTags(TAGS[level]).analyze();
  log(`axe-core ${results.testEngine.version}: ${results.violations.length} reglas incumplidas, ${results.passes.length} superadas.`);

  const topLevel = results.violations.flatMap((violation) =>
    violation.nodes.filter((n) => isTopLevel(n.target)).map((n) => selectorOf(n.target)),
  );
  const uniqueSelectors = [...new Set(topLevel)];
  const rects = new Map<string, Rect | null>();
  const measured = await runtime.rects(page.mainFrame(), uniqueSelectors);
  uniqueSelectors.forEach((selector, i) => rects.set(selector, measured[i] ?? null));

  // Los rects ya están en coordenadas de documento: se recorta sin desplazar la página.
  let crops = 0;
  const viewportArea = sizes.viewport.width * sizes.viewport.height;
  const cropFor = async (rect: Rect | null): Promise<string | null> => {
    if (crops >= MAX_CROPS || !rect || rect.width * rect.height > viewportArea * 0.4 || rect.width < 2 || rect.height < 2) return null;
    const clip = padToViewport(rect, 8, sizes.document);
    if (!clip) return null;
    try {
      const image = await captureDocumentClip(page, clip);
      crops += 1;
      return toDataUrl(image, 'png');
    } catch {
      return null;
    }
  };

  const findings: Finding[] = [];
  // Los recortes enseñan el nodo, no la barra fija que en la captura de documento queda encima.
  await withoutFixedOverlays(page, uniqueSelectors, async () => {
    for (const violation of results.violations as Result[]) {
      const nodes: NodeInput[] = [];
      for (const [index, axeNode] of violation.nodes.entries()) {
        if (index >= MAX_NODES_PER_FINDING) break;
        const selector = selectorOf(axeNode.target);
        const rect = rects.get(selector) ?? null;
        nodes.push({
          selector,
          html: axeNode.html.slice(0, 600),
          rect,
          note: axeNode.failureSummary?.replace(/\s+/g, ' ').trim() ?? null,
          evidence: { crop: await cropFor(rect) },
          fix: violation.id.startsWith('color-contrast') ? contrastFix(axeNode, selector) : null,
        });
      }
      findings.push(
        finding({
          source: 'axe',
          rule: violation.id,
          title: violation.help,
          detail: violation.description,
          severity: IMPACT_TO_SEVERITY[violation.impact ?? 'minor'] ?? 'low',
          wcag: wcagFromTags(violation.tags),
          helpUrl: violation.helpUrl,
          occurrences: violation.nodes.length,
          nodes,
        }),
      );
    }
  });
  return { findings, version: results.testEngine.version };
}

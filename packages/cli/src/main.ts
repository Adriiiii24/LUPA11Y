#!/usr/bin/env node
/**
 * lupa11y <url...> [opciones]
 *
 * Códigos de salida: 0 sin hallazgos por encima del umbral · 1 hay hallazgos · 2 alguna auditoría falló.
 * Con `--baseline`, solo cuenta lo que empeora respecto a ese informe.
 * El progreso va a stderr para que `--json` deje stdout limpio.
 */
import { access, appendFile, readFile, writeFile } from 'node:fs/promises';
import { parseArgs, styleText } from 'node:util';
import {
  audit,
  compareBatches,
  comparisonToMarkdown,
  createBrowserPool,
  isAuditError,
  meetsThreshold,
  parseAuditUrl,
  parseReports,
  PHASE_LABEL,
  regressions,
  SCHEMA_VERSION,
  SEVERITIES,
  SEVERITY_LABEL,
  SOURCE_LABEL,
  SOURCES,
  toMarkdownBatch,
  toSarif,
  withoutImages,
  type AuditBatch,
  type Finding,
  type Report,
  type ReportComparison,
  type Severity,
} from '@lupa11y/core';
import pkg from '../package.json' with { type: 'json' };
import { sitemapUrls } from './sitemap.ts';

const HELP = `LupA11y · auditoría de accesibilidad agéntica

Uso: lupa11y <url...> [opciones]

  --fail-on <nivel>       critical | high | medium | low | none   (por defecto: high)
  --level <nivel>         AA | AAA                                (por defecto: AA)
  --sitemap <url>         audita las páginas de un sitemap.xml (además de las URL dadas)
  --max-pages <n>         páginas como máximo                       (por defecto: 10)
  --baseline <ruta>       informe JSON anterior: solo falla por lo que empeora
  --out <ruta>            guarda el informe JSON completo (un lote si hay varias páginas)
  --sarif <ruta>          guarda los hallazgos en SARIF 2.1.0 (escaneo de código de GitHub)
  --summary <ruta>        añade el resumen Markdown (en Actions: $GITHUB_STEP_SUMMARY)
  --json                  imprime el informe JSON por stdout
  --no-images             quita las capturas del JSON
  --no-vision             no consulta a Gemini aunque haya GEMINI_API_KEY
  --no-keyboard           omite el agente de teclado
  --no-layout             omite el reflujo a 320 px y el espaciado de texto
  --max-stops <n>         paradas de Tab como máximo                 (por defecto: 60)
  --timeout <s>           presupuesto por página en segundos          (por defecto: 120)
  --storage-state <ruta>  sesión de Playwright (cookies y localStorage) para páginas con login
  --header <cabecera>     «Nombre: valor» que solo viaja al origen auditado; se puede repetir
  -h, --help              esta ayuda

Variables: GEMINI_API_KEY activa la fase de visión · LUPA11Y_VISION_MODEL elige el modelo ·
LUPA11Y_VISION_FALLBACK_MODEL es el de reserva · LUPA11Y_VISION_RPM y LUPA11Y_VISION_MAX_CALLS limitan las consultas.`;

const SEVERITY_STYLE: Record<Severity, Parameters<typeof styleText>[0]> = {
  critical: ['bold', 'red'],
  high: 'red',
  medium: 'yellow',
  low: 'gray',
};

const SOURCE_WIDTH = Math.max(...SOURCES.map((source) => SOURCE_LABEL[source].length));

const err = (text: string) => process.stderr.write(`${text}\n`);
const paint = (format: Parameters<typeof styleText>[0], text: string, stream: NodeJS.WriteStream = process.stdout) =>
  styleText(format, text, { validateStream: true, stream });

const HEADER_NAME = /^[!#$%&'*+.^_`|~\w-]+$/;

function parseHeaders(values: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const raw of values) {
    const colon = raw.indexOf(':');
    const name = raw.slice(0, colon).trim();
    if (colon < 1 || !HEADER_NAME.test(name)) throw new Error(`--header espera «Nombre: valor» y recibió «${raw}».`);
    headers[name] = raw.slice(colon + 1).trim();
  }
  return headers;
}

function parse() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'fail-on': { type: 'string', default: 'high' },
      level: { type: 'string', default: 'AA' },
      sitemap: { type: 'string' },
      'max-pages': { type: 'string', default: '10' },
      baseline: { type: 'string' },
      out: { type: 'string' },
      sarif: { type: 'string' },
      summary: { type: 'string' },
      json: { type: 'boolean', default: false },
      'no-images': { type: 'boolean', default: false },
      'no-vision': { type: 'boolean', default: false },
      'no-keyboard': { type: 'boolean', default: false },
      'no-layout': { type: 'boolean', default: false },
      'max-stops': { type: 'string', default: '60' },
      timeout: { type: 'string', default: '120' },
      'storage-state': { type: 'string' },
      header: { type: 'string', multiple: true, default: [] },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const failOn = values['fail-on'];
  if (failOn !== 'none' && !SEVERITIES.includes(failOn as Severity)) throw new Error(`--fail-on no acepta «${failOn}».`);
  const level: 'AA' | 'AAA' | null = values.level === 'AA' ? 'AA' : values.level === 'AAA' ? 'AAA' : null;
  if (!level) throw new Error(`--level no acepta «${values.level}».`);
  const maxStops = Number.parseInt(values['max-stops'], 10);
  const timeout = Number.parseInt(values.timeout, 10);
  const maxPages = Number.parseInt(values['max-pages'], 10);
  if (!Number.isInteger(maxStops) || maxStops < 1 || maxStops > 500) throw new Error('--max-stops debe estar entre 1 y 500.');
  if (!Number.isInteger(timeout) || timeout < 10 || timeout > 900) throw new Error('--timeout debe estar entre 10 y 900 segundos.');
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 200) throw new Error('--max-pages debe estar entre 1 y 200.');
  return {
    ...values,
    urls: positionals,
    failOn: failOn as Severity | 'none',
    level,
    maxStops,
    timeout,
    maxPages,
    headers: parseHeaders(values.header),
  };
}

/** Anotaciones de GitHub Actions: aparecen en el resumen del job. Error solo lo que hace fallar el job. */
function annotate(reports: readonly Report[], failing: ReadonlySet<Finding>) {
  let written = 0;
  for (const report of reports) {
    for (const finding of report.findings) {
      if (written >= 20) return;
      written += 1;
      const kind = failing.has(finding) ? 'error' : 'warning';
      const page = reports.length > 1 ? ` (${new URL(report.finalUrl).pathname})` : '';
      const title = `${SEVERITY_LABEL[finding.severity]} · ${finding.title}${page}`.replace(/[\r\n:,]/g, ' ');
      const message = `${finding.detail} (${finding.nodes[0]?.selector ?? ''})`.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      process.stdout.write(`::${kind} title=${title}::${message}\n`);
    }
  }
}

function printReport(report: Report, failing: ReadonlySet<Finding>, comparison: ReportComparison | null) {
  const { bySeverity } = report.summary;
  const out = (line = '') => process.stdout.write(`${line}\n`);
  const added = new Set(comparison ? [...comparison.added, ...comparison.changed.filter((c) => c.newNodes.length > 0).map((c) => c.finding)] : []);
  out();
  out(paint('bold', `LupA11y · ${report.title || report.finalUrl}`));
  out(paint('gray', `${report.finalUrl} · WCAG 2.2 ${report.wcagLevel} · ${(report.durationMs / 1000).toFixed(1)} s`));
  out();
  out(SEVERITIES.map((s) => paint(SEVERITY_STYLE[s], `${SEVERITY_LABEL[s]} ${bySeverity[s]}`)).join('   '));
  out();
  for (const finding of report.findings) {
    const flag = failing.has(finding) ? '✖' : '·';
    const fresh = added.has(finding) ? ` ${paint('bold', 'nuevo')}` : '';
    out(
      `${paint(SEVERITY_STYLE[finding.severity], `${flag} ${SEVERITY_LABEL[finding.severity].padEnd(7)}`)} ${paint('gray', SOURCE_LABEL[finding.source].padEnd(SOURCE_WIDTH))} ${finding.title} ${paint('gray', `×${finding.occurrences}`)}${fresh}`,
    );
  }
  if (report.findings.length === 0) out(paint('green', 'Sin hallazgos automáticos.'));
  if (comparison) {
    out();
    out(paint('gray', comparisonToMarkdown(comparison).split('\n').slice(2).join('\n')));
  }
  out();
}

async function collectUrls(options: ReturnType<typeof parse>): Promise<string[]> {
  const urls = [...options.urls];
  if (options.sitemap) {
    const fromSitemap = await sitemapUrls(parseAuditUrl(options.sitemap).href, options.maxPages);
    err(paint('gray', `Sitemap: ${fromSitemap.length} páginas.`, process.stderr));
    urls.push(...fromSitemap);
  }
  return [...new Set(urls)].slice(0, Math.max(options.urls.length, options.maxPages));
}

async function main(): Promise<number> {
  let options: ReturnType<typeof parse>;
  try {
    options = parse();
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    err('Usa --help para ver las opciones.');
    return 2;
  }
  if (options.help || (options.urls.length === 0 && !options.sitemap)) {
    (options.help ? process.stdout : process.stderr).write(`${HELP}\n`);
    return options.help ? 0 : 2;
  }

  let baseline: Report[] | null = null;
  try {
    if (options['storage-state']) await access(options['storage-state']);
    if (options.baseline) baseline = parseReports(JSON.parse(await readFile(options.baseline, 'utf8')));
  } catch (error) {
    err(paint('red', `✖ No se pudo leer ${options.baseline && !baseline ? `la línea base ${options.baseline}` : `la sesión ${options['storage-state']}`}: ${error instanceof Error ? error.message : error}`, process.stderr));
    return 2;
  }

  let urls: string[];
  try {
    urls = await collectUrls(options);
  } catch (error) {
    err(paint('red', `✖ ${error instanceof Error ? error.message : String(error)}`, process.stderr));
    return 2;
  }
  if (urls.length === 0) {
    err(paint('red', '✖ No hay ninguna página que auditar.', process.stderr));
    return 2;
  }

  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  const pool = createBrowserPool();
  const reports: Report[] = [];
  let failedAudits = 0;
  try {
    for (const [index, url] of urls.entries()) {
      if (controller.signal.aborted) break;
      if (urls.length > 1) err(paint('bold', `\n[${index + 1}/${urls.length}] ${url}`, process.stderr));
      const lease = await pool.acquire().catch((error: unknown) => {
        err(paint('red', `✖ ${isAuditError(error) ? error.message : String(error)}`, process.stderr));
        return null;
      });
      if (!lease) return 2;
      try {
        reports.push(
          await audit(url, {
            network: 'any',
            level: options.level,
            browser: lease.browser,
            timeoutMs: options.timeout * 1000,
            keyboard: options['no-keyboard'] ? false : { maxStops: options.maxStops },
            layout: !options['no-layout'],
            ...(options['no-vision'] ? { vision: false as const } : {}),
            ...(options['storage-state'] ? { storageState: options['storage-state'] } : {}),
            ...(Object.keys(options.headers).length > 0 ? { headers: options.headers } : {}),
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === 'phase' && event.state !== 'running') {
                const mark = { done: '✓', skipped: '–', failed: '✖' }[event.state];
                err(paint('gray', `${mark} ${PHASE_LABEL[event.phase]}: ${event.message}`, process.stderr));
              }
            },
          }),
        );
      } catch (error) {
        failedAudits += 1;
        err(paint('red', `✖ ${isAuditError(error) ? error.message : String(error)}`, process.stderr));
      } finally {
        lease.release();
      }
    }
  } finally {
    await pool.close();
  }
  if (reports.length === 0) return 2;

  const comparisons = baseline ? compareBatches(baseline, reports) : null;
  const failing = new Set<Finding>(
    options.failOn === 'none'
      ? []
      : comparisons
        ? comparisons.flatMap(({ comparison }) => regressions(comparison, options.failOn as Severity))
        : reports.flatMap((report) => report.findings.filter((f) => meetsThreshold(f.severity, options.failOn as Severity))),
  );

  const output = reports.map((report) => (options['no-images'] ? withoutImages(report) : report));
  const payload: Report | AuditBatch =
    output.length === 1 && output[0] ? output[0] : { schemaVersion: SCHEMA_VERSION, generatedAt: new Date().toISOString(), reports: output };
  if (options.out) await writeFile(options.out, JSON.stringify(payload, null, 2));
  if (options.sarif) {
    await writeFile(options.sarif, JSON.stringify(toSarif(reports, { toolVersion: pkg.version, informationUri: 'https://github.com/Adriiiii24/LupA11y' }), null, 2));
  }
  if (options.summary) {
    const changes = comparisons?.map(({ comparison }, i) => `${reports.length > 1 ? `#### ${reports[i]?.finalUrl}\n\n` : ''}${comparisonToMarkdown(comparison)}`) ?? [];
    await appendFile(options.summary, `${toMarkdownBatch(reports)}\n${changes.length ? `\n${changes.join('\n\n')}\n` : ''}`);
  }
  if (options.json) process.stdout.write(`${JSON.stringify(payload)}\n`);
  else reports.forEach((report, i) => printReport(report, failing, comparisons?.[i]?.comparison ?? null));
  if (process.env['GITHUB_ACTIONS'] === 'true') annotate(reports, failing);

  if (failing.size > 0 && !options.json) {
    const what = comparisons ? 'nuevos o que empeoran' : 'de severidad';
    err(paint('red', `${failing.size} hallazgos ${what} ${SEVERITY_LABEL[options.failOn as Severity].toLowerCase()} o superior.`, process.stderr));
  }
  if (failedAudits > 0) return 2;
  return failing.size > 0 ? 1 : 0;
}

process.exitCode = await main();

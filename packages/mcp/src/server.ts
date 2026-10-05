#!/usr/bin/env node
/**
 * Servidor MCP de LupA11y (stdio).
 *
 * Una herramienta, `audit_url`, pensada para el bucle «audita localhost, arregla, vuelve a auditar»
 * dentro de Claude Code o Cursor. Devuelve Markdown con los diffs (lo que un agente necesita
 * para editar) o el JSON del contrato sin imágenes, que en un contexto de LLM solo ocupan tokens.
 *
 * Para ese bucle, el servidor mantiene Chromium arrancado entre llamadas y recuerda la última
 * auditoría de cada URL: la siguiente contesta qué se arregló, qué es nuevo y qué sigue igual.
 * Además del texto, devuelve un resumen estructurado (`structuredContent`) que el agente puede leer
 * sin interpretar Markdown.
 *
 * stdout pertenece al protocolo: aquí no se escribe nada por consola.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  audit,
  compareReports,
  comparisonToMarkdown,
  createBrowserPool,
  isAuditError,
  PHASES,
  samePage,
  toMarkdown,
  withoutImages,
  type Report,
  type ReportComparison,
} from '@lupa11y/core';
import pkg from '../package.json' with { type: 'json' };

const server = new McpServer({ name: 'lupa11y', version: pkg.version });
const pool = createBrowserPool();

/** La última auditoría de cada página, sin imágenes. Las más antiguas salen primero. */
const previous: Report[] = [];
const MAX_REMEMBERED = 20;

function remember(report: Report): Report | null {
  const index = previous.findIndex((old) => samePage(old, report));
  const before = index === -1 ? null : (previous.splice(index, 1)[0] ?? null);
  previous.push(withoutImages(report));
  if (previous.length > MAX_REMEMBERED) previous.shift();
  return before;
}

const counts = (comparison: ReportComparison) => ({
  resolved: comparison.resolved.map((f) => f.id),
  added: comparison.added.map((f) => f.id),
  worse: comparison.changed.filter((c) => c.newNodes.length > 0 || c.occurrencesAfter > c.occurrencesBefore).map((c) => c.finding.id),
  better: comparison.changed.filter((c) => c.newNodes.length === 0 && c.occurrencesAfter <= c.occurrencesBefore).map((c) => c.finding.id),
  unchanged: comparison.unchanged.length,
});

server.registerTool(
  'audit_url',
  {
    title: 'Auditar accesibilidad de una URL',
    description: [
      'Audita la accesibilidad de una página: axe-core (reglas WCAG 2.2), reflujo a 320 px y espaciado de texto (WCAG 1.4.10 y 1.4.12),',
      'un agente que recorre la página con Tab midiendo el foco píxel a píxel (trampas, foco invisible o tapado, controles que no',
      'responden a Enter) y Gemini Vision (alt que no describe la imagen, focos débiles). Cada hallazgo trae selector, fragmento HTML',
      'y un diff de corrección. Acepta localhost: úsalo para auditar tu app en desarrollo, aplicar los diffs y volver a auditar;',
      'la segunda llamada a la misma URL dice qué se arregló y qué es nuevo.',
    ].join(' '),
    inputSchema: {
      url: z.string().min(1).describe('URL que se audita, p. ej. http://localhost:3000/checkout'),
      level: z.enum(['AA', 'AAA']).default('AA').describe('Nivel WCAG. AA es el que exige la EN 301 549 (Acta Europea de Accesibilidad).'),
      vision: z.boolean().default(true).describe('Consulta a Gemini si hay GEMINI_API_KEY en el entorno del servidor.'),
      layout: z.boolean().default(true).describe('Comprueba el reflujo a 320 px y el espaciado de texto.'),
      format: z.enum(['markdown', 'json']).default('markdown').describe('markdown: resumen con diffs. json: el informe completo sin imágenes.'),
      max_findings: z.number().int().min(1).max(100).default(25).describe('Máximo de hallazgos en el resumen Markdown.'),
      compare: z.boolean().default(true).describe('Compara con la auditoría anterior de la misma URL en esta sesión.'),
    },
    outputSchema: {
      url: z.string(),
      total: z.number().int(),
      bySeverity: z.object({ critical: z.number().int(), high: z.number().int(), medium: z.number().int(), low: z.number().int() }),
      findings: z.array(z.object({ id: z.string(), severity: z.string(), title: z.string(), occurrences: z.number().int(), fixes: z.number().int() })),
      changes: z
        .object({
          resolved: z.array(z.string()),
          added: z.array(z.string()),
          worse: z.array(z.string()),
          better: z.array(z.string()),
          unchanged: z.number().int(),
        })
        .nullable(),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ url, level, vision, layout, format, max_findings, compare }, extra) => {
    const progressToken = extra._meta?.progressToken;
    const notify = (progress: number, message: string) =>
      progressToken === undefined
        ? Promise.resolve()
        : extra.sendNotification({ method: 'notifications/progress', params: { progressToken, progress, total: PHASES.length, message } }).catch(() => undefined);
    let lease: Awaited<ReturnType<typeof pool.acquire>> | null = null;
    try {
      lease = await pool.acquire();
      const report = await audit(url, {
        network: 'any',
        level,
        layout,
        browser: lease.browser,
        ...(vision ? {} : { vision: false as const }),
        signal: extra.signal,
        onEvent: (event) => {
          if (event.type === 'phase' && event.state !== 'running') void notify(PHASES.indexOf(event.phase) + 1, event.message);
        },
      });
      const before = remember(report);
      const comparison = compare && before ? compareReports(before, report) : null;
      const body = format === 'json' ? JSON.stringify(withoutImages(report)) : toMarkdown(report, { maxFindings: max_findings });
      return {
        content: [
          ...(comparison ? [{ type: 'text' as const, text: comparisonToMarkdown(comparison, { heading: '##' }) }] : []),
          { type: 'text' as const, text: body },
        ],
        structuredContent: {
          url: report.finalUrl,
          total: report.summary.total,
          bySeverity: report.summary.bySeverity,
          findings: report.findings.map((f) => ({
            id: f.id,
            severity: f.severity,
            title: f.title,
            occurrences: f.occurrences,
            fixes: f.nodes.filter((n) => n.fix).length,
          })),
          changes: comparison ? counts(comparison) : null,
        },
      };
    } catch (error) {
      const message = isAuditError(error) ? `${error.code}: ${error.message}` : String(error);
      return { content: [{ type: 'text', text: `No se pudo auditar ${url}. ${message}` }], isError: true };
    } finally {
      lease?.release();
    }
  },
);

server.server.onclose = () => {
  void pool.close();
};

await server.connect(new StdioServerTransport());

/**
 * POST /api/audit  { url }  →  application/x-ndjson
 *
 * Cada línea es un `AuditEvent` del contrato: fases, logs, la captura, hallazgos parciales y, al
 * final, `result` (y `saved` si los enlaces permanentes están activos) o `error`.
 * La consola de la web pinta estos eventos reales, no una animación simulada.
 */
import { audit, AuditRequest, isAuditError, type AuditEvent, type NetworkPolicy } from '@lupa11y/core';
import { browserPool, clientKey, createGate, gateConfig } from '@/lib/server/audit-gate';
import { log } from '@/lib/server/log';
import { reportStore } from '@/lib/server/report-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Margen para que el motor cierre con su propio evento `timeout` antes de que la plataforma corte. */
const AUDIT_BUDGET_MS = (maxDuration - 15) * 1000;

/** En producción solo hosts públicos; en local se puede auditar localhost (y la demo). */
const NETWORK: NetworkPolicy =
  process.env['LUPA11Y_NETWORK'] === 'any' || (process.env.NODE_ENV !== 'production' && process.env['LUPA11Y_NETWORK'] !== 'public-only')
    ? 'any'
    : 'public-only';

const config = gateConfig();
const gate = createGate(config);

const BUSY_MESSAGE = {
  busy: 'El auditor está ocupado con otras páginas. Prueba de nuevo en unos segundos.',
  client: 'Has lanzado muchas auditorías seguidas.',
  global: 'El auditor ha llegado a su límite de auditorías por ahora.',
} as const;

const problem = (status: number, code: string, message: string, headers: HeadersInit = {}) =>
  Response.json({ code, message }, { status, headers: { 'cache-control': 'no-store', ...headers } });

export async function POST(request: Request): Promise<Response> {
  const body = AuditRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return problem(400, 'invalid_url', 'Envía un JSON con la URL que quieres auditar: { "url": "https://…" }.');

  const admission = gate.admit(clientKey(request.headers, config));
  if (!admission.ok) {
    const minutes = Math.ceil(admission.retryAfter / 60);
    const when = admission.reason === 'busy' ? '' : ` Vuelve a intentarlo en ${minutes} min.`;
    log('warn', 'audit.rejected', { reason: admission.reason, retryAfter: admission.retryAfter });
    return problem(admission.reason === 'busy' ? 503 : 429, 'rate_limited', `${BUSY_MESSAGE[admission.reason]}${when}`, {
      'retry-after': String(admission.retryAfter),
    });
  }

  const target = (() => {
    try {
      return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(body.data.url) ? body.data.url : `https://${body.data.url}`).host;
    } catch {
      return 'inválida';
    }
  })();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reportedError = false;
      const send = (event: AuditEvent) => {
        if (event.type === 'error') reportedError = true;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // El cliente cerró la conexión: el abort de la petición cancela la auditoría.
        }
      };
      const started = performance.now();
      let lease: Awaited<ReturnType<ReturnType<typeof browserPool>['acquire']>> | null = null;
      try {
        lease = await browserPool().acquire();
        const report = await audit(body.data.url, {
          network: NETWORK,
          browser: lease.browser,
          timeoutMs: AUDIT_BUDGET_MS,
          signal: request.signal,
          exposeInternalErrors: NETWORK !== 'public-only',
          onInternalError: (error, phase) => log('error', 'audit.internal_error', { host: target, phase, error }),
          onEvent: send,
        });
        log('info', 'audit.done', {
          host: target,
          durationMs: report.durationMs,
          findings: report.summary.total,
          phases: Object.fromEntries(report.phases.map((p) => [p.id, `${p.status}:${p.durationMs}`])),
        });
        const store = reportStore();
        if (store) {
          const id = await store.save(report).catch((error: unknown) => {
            log('error', 'report.save_failed', { error });
            return null;
          });
          if (id) send({ type: 'saved', id, path: `/r/${id}` });
        }
      } catch (error) {
        log(isAuditError(error) ? 'warn' : 'error', 'audit.failed', {
          host: target,
          code: isAuditError(error) ? error.code : 'browser_unavailable',
          durationMs: Math.round(performance.now() - started),
          error,
        });
        // El motor ya emitió su evento `error`, salvo si falló antes de empezar (Chromium ausente).
        if (!reportedError) {
          send(
            isAuditError(error)
              ? { type: 'error', code: error.code, message: error.message }
              : { type: 'error', code: 'browser_unavailable', message: 'No se pudo arrancar el navegador del auditor.' },
          );
        }
      } finally {
        lease?.release();
        admission.release();
        try {
          controller.close();
        } catch {
          // Ya cerrado por el cliente.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}

'use client';

/**
 * Cliente del stream NDJSON de `POST /api/audit`. Cada línea se valida contra el contrato Zod
 * antes de tocar el estado: lo que no cumple el esquema no llega a la interfaz.
 *
 * Además del registro, guarda lo provisional (la captura y los hallazgos de cada fase cerrada), el
 * informe anterior (para decir qué cambió si se vuelve a auditar la misma página) y el enlace
 * permanente, si el servidor lo guardó.
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AuditEvent, type ErrorCode, type Report } from '@lupa11y/core/schema';
import { applyPartial, type LiveAudit } from './live-report';
import { readNdjson } from './ndjson';

export interface LogEntry {
  id: number;
  at: number;
  event: Extract<AuditEvent, { type: 'phase' | 'log' | 'error' }>;
}

export interface AuditState {
  status: 'idle' | 'running' | 'done' | 'error';
  url: string | null;
  startedAt: number | null;
  /** Hora de inicio en ISO, para el informe provisional. */
  startedIso: string | null;
  log: LogEntry[];
  report: Report | null;
  /** Lo que ya se sabe mientras la auditoría sigue en marcha. */
  live: LiveAudit | null;
  /** El último informe completo antes de esta auditoría. */
  previous: Report | null;
  /** Ruta del enlace permanente, si el servidor guardó el informe. */
  savedPath: string | null;
  error: { code: ErrorCode | 'network'; message: string } | null;
}

type Action =
  | { type: 'start'; url: string; at: number; iso: string }
  | { type: 'event'; event: AuditEvent; at: number }
  | { type: 'fail'; code: ErrorCode | 'network'; message: string }
  | { type: 'cancel' }
  | { type: 'reset' };

const initial: AuditState = {
  status: 'idle',
  url: null,
  startedAt: null,
  startedIso: null,
  log: [],
  report: null,
  live: null,
  previous: null,
  savedPath: null,
  error: null,
};

function reducer(state: AuditState, action: Action): AuditState {
  switch (action.type) {
    case 'start':
      return { ...initial, status: 'running', url: action.url, startedAt: action.at, startedIso: action.iso, previous: state.report ?? state.previous };
    case 'event': {
      const { event } = action;
      switch (event.type) {
        case 'result':
          return { ...state, status: 'done', report: event.report, live: null };
        case 'capture':
          return { ...state, live: { capture: event, findings: {}, keyboard: null } };
        case 'partial':
          return state.live ? { ...state, live: applyPartial(state.live, event) } : state;
        case 'saved':
          return { ...state, savedPath: event.path };
        case 'error': {
          const log = [...state.log, { id: state.log.length, at: action.at, event }];
          return { ...state, log, status: 'error', live: null, error: { code: event.code, message: event.message } };
        }
        default:
          return { ...state, log: [...state.log, { id: state.log.length, at: action.at, event }] };
      }
    }
    case 'fail':
      return { ...state, status: 'error', live: null, error: { code: action.code, message: action.message } };
    case 'cancel':
      return state.status === 'running' ? { ...state, status: 'error', live: null, error: { code: 'aborted', message: 'Auditoría cancelada.' } } : state;
    case 'reset':
      return { ...initial, previous: state.report ?? state.previous };
  }
}

export function useAuditStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  /** Resuelve con el informe cuando termina bien, o null si falla o se cancela. */
  const start = useCallback(async (url: string): Promise<Report | null> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    dispatch({ type: 'start', url, at: performance.now(), iso: new Date().toISOString() });
    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: current.signal,
      });
      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { code?: ErrorCode; message?: string } | null;
        dispatch({ type: 'fail', code: payload?.code ?? 'internal', message: payload?.message ?? `El servidor respondió ${response.status}.` });
        return null;
      }
      let finished = false;
      let report: Report | null = null;
      await readNdjson(response.body, (line) => {
        let raw: unknown;
        try {
          raw = JSON.parse(line);
        } catch {
          return;
        }
        const parsed = AuditEvent.safeParse(raw);
        if (!parsed.success) return;
        if (parsed.data.type === 'result') report = parsed.data.report;
        if (parsed.data.type === 'result' || parsed.data.type === 'error') finished = true;
        dispatch({ type: 'event', event: parsed.data, at: performance.now() });
      });
      if (!finished && !current.signal.aborted) {
        dispatch({ type: 'fail', code: 'internal', message: 'La conexión se cerró antes de terminar la auditoría.' });
      }
      return current.signal.aborted ? null : report;
    } catch {
      if (!current.signal.aborted) {
        dispatch({ type: 'fail', code: 'network', message: 'No hay conexión con el auditor. Revisa tu red y vuelve a intentarlo.' });
      }
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    dispatch({ type: 'reset' });
  }, []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    dispatch({ type: 'cancel' });
  }, []);

  return { state, start, cancel, reset };
}

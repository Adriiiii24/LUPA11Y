import type { ErrorCode } from './schema.ts';

/** Único tipo de error que el motor deja escapar. El mensaje va en español y es apto para el usuario. */
export class AuditError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AuditError';
    this.code = code;
  }
}

export const isAuditError = (error: unknown): error is AuditError => error instanceof AuditError;

/** Normaliza cualquier fallo a `AuditError` sin perder la causa original. */
export function toAuditError(error: unknown, signal?: AbortSignal): AuditError {
  if (isAuditError(error)) return error;
  if (signal?.aborted) {
    const reason: unknown = signal.reason;
    const timedOut = reason instanceof DOMException && reason.name === 'TimeoutError';
    return timedOut
      ? new AuditError('timeout', 'La auditoría superó el tiempo máximo y se canceló.', { cause: error })
      : new AuditError('aborted', 'La auditoría se canceló.', { cause: error });
  }
  const detail = error instanceof Error ? error.message : String(error);
  return new AuditError('internal', `Fallo interno del motor: ${detail}`, { cause: error });
}

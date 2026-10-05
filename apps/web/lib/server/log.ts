/**
 * Registro estructurado: una línea JSON por evento en stdout (o stderr para errores), que cualquier
 * plataforma (Fly, Cloud Run, Vercel, Docker) recoge y deja filtrar por campo.
 */
type Level = 'info' | 'warn' | 'error';

const serialize = (value: unknown): unknown => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, ...(value.cause ? { cause: serialize(value.cause) } : {}) };
  }
  return value;
};

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, serialize(v)])) });
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

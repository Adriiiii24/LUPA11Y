/**
 * Puerta de la API pública: quién audita, cuántas veces y con qué navegador.
 *
 * - Identidad del cliente: solo se confía en una cabecera de IP si el despliegue lo declara
 *   (`LUPA11Y_CLIENT_IP_HEADER`, o `LUPA11Y_TRUSTED_PROXIES` saltos de `x-forwarded-for`). En Vercel,
 *   `x-real-ip` la pone la plataforma y se usa sola. Sin nada de eso, cualquiera podría inventarse
 *   una IP en cada petición: todas las peticiones comparten entonces una sola cuota.
 * - Cuota por cliente (6 cada 10 min) y presupuesto global del proceso (60 cada 10 min), que acota
 *   el coste aunque alguien consiga muchas identidades.
 * - Concurrencia: 2 auditorías a la vez. El hueco se reserva antes que la cuota: un «ocupado» no gasta cuota.
 *
 * Todo vive en memoria del proceso. Con varias instancias, cada una lleva su cuenta: es un freno de
 * abuso para la demo, no una cuota de facturación. En producción seria, la cuota va a un almacén
 * compartido (Redis, Upstash…).
 */
import { createBrowserPool, PUBLIC_BROWSER_ARGS, type BrowserPool } from '@lupa11y/core';

const WINDOW_MS = 10 * 60_000;

export interface GateConfig {
  perClient: number;
  global: number;
  concurrent: number;
  /** Cabecera con la IP real que pone un proxy de confianza (`x-real-ip`, `cf-connecting-ip`, `fly-client-ip`…). */
  ipHeader: string | null;
  /** Proxies de confianza delante de la app: la IP es la entrada n-ésima empezando por el final de `x-forwarded-for`. */
  trustedProxies: number;
}

const positive = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function gateConfig(env: Record<string, string | undefined> = process.env): GateConfig {
  const header = env['LUPA11Y_CLIENT_IP_HEADER']?.trim().toLowerCase() || (env['VERCEL'] ? 'x-real-ip' : null);
  return {
    perClient: positive(env['LUPA11Y_QUOTA_PER_CLIENT'], 6),
    global: positive(env['LUPA11Y_QUOTA_GLOBAL'], 60),
    concurrent: positive(env['LUPA11Y_MAX_CONCURRENT'], 2),
    ipHeader: header,
    trustedProxies: positive(env['LUPA11Y_TRUSTED_PROXIES'], 0),
  };
}

/** La IP del cliente, solo de fuentes declaradas de confianza; `null` si no hay ninguna. */
export function clientKey(headers: Headers, config: Pick<GateConfig, 'ipHeader' | 'trustedProxies'>): string | null {
  if (config.ipHeader) {
    const value = headers.get(config.ipHeader)?.split(',')[0]?.trim();
    if (value) return value;
  }
  if (config.trustedProxies > 0) {
    const hops = headers
      .get('x-forwarded-for')
      ?.split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    // Cada proxy de confianza añade un salto al final; lo que haya antes lo pudo escribir el cliente.
    const candidate = hops?.[hops.length - config.trustedProxies];
    if (candidate) return candidate;
  }
  return null;
}

export interface Gate {
  /** Reserva un hueco y gasta cuota. Devuelve cómo liberar el hueco o por qué no se puede auditar. */
  admit(key: string | null, now?: number): { ok: true; release: () => void } | { ok: false; reason: 'busy' | 'client' | 'global'; retryAfter: number };
}

export function createGate(config: GateConfig): Gate {
  const hits = new Map<string, number[]>();
  let global: number[] = [];
  let running = 0;

  const recent = (times: readonly number[], now: number) => times.filter((t) => now - t < WINDOW_MS);
  const wait = (times: readonly number[], now: number) => Math.max(1, Math.ceil((WINDOW_MS - (now - (times[0] ?? now))) / 1000));

  return {
    admit(key, now = Date.now()) {
      if (running >= config.concurrent) return { ok: false, reason: 'busy', retryAfter: 15 };
      global = recent(global, now);
      if (global.length >= config.global) return { ok: false, reason: 'global', retryAfter: wait(global, now) };
      // Sin identidad de confianza, todo el mundo comparte una cuota: es lo único que no se puede falsear.
      const id = key ?? 'anónimo';
      const mine = recent(hits.get(id) ?? [], now);
      if (mine.length >= config.perClient) {
        hits.set(id, mine);
        return { ok: false, reason: 'client', retryAfter: wait(mine, now) };
      }
      mine.push(now);
      hits.set(id, mine);
      global.push(now);
      if (hits.size > 5_000) {
        for (const [k, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
      }
      running += 1;
      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          running -= 1;
        },
      };
    },
  };
}

let pool: BrowserPool | null = null;

/** Un Chromium por proceso, con WebRTC limitado al proxy; cada auditoría abre su propio contexto. */
export function browserPool(): BrowserPool {
  pool ??= createBrowserPool({ launch: { args: PUBLIC_BROWSER_ARGS } });
  return pool;
}

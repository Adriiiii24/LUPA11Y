/**
 * Política de red del navegador auditor.
 *
 * - `public-only` (la web pública): solo hosts que resuelven a IP pública, para que nadie use
 *   el motor como proxy hacia la red interna (SSRF). Se comprueba la URL de entrada, cada
 *   petición del navegador y cada salto de redirección.
 * - `any` (CLI y MCP): corren en la máquina del usuario y deben poder auditar `localhost`.
 *
 * El modo de solo lectura, activo durante la fase de teclado, bloquea todo lo que no sea
 * GET/HEAD/OPTIONS y cualquier navegación: el agente nunca envía un formulario ni sale de la página.
 *
 * En `public-only`, además, el navegador sale a Internet a través del proxy de `egress-proxy.ts`,
 * que resuelve cada host una sola vez y se conecta a la IP que acaba de validar. Así no cabe un
 * DNS rebinding entre nuestra comprobación y la conexión del navegador.
 */
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import type { BrowserContext, Request, Route } from 'playwright';
import { AuditError } from './errors.ts';

export type NetworkPolicy = 'public-only' | 'any';

const reserved = new BlockList();
const IPV4_RESERVED: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];
const IPV6_RESERVED: ReadonlyArray<readonly [string, number]> = [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
];
for (const [network, prefix] of IPV4_RESERVED) reserved.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of IPV6_RESERVED) reserved.addSubnet(network, prefix, 'ipv6');

const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.lan', '.intranet'];

/** true si la dirección no es enrutable en Internet. Lo que no es una IP se considera no pública. */
export function isReservedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  // BlockList compara también las IPv4 mapeadas (::ffff:10.0.0.1) contra los rangos IPv4.
  return reserved.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

const stripBrackets = (hostname: string): string => hostname.replace(/^\[(.*)\]$/, '$1').toLowerCase();

/** Normaliza lo que pega el usuario («example.com» → https://example.com/) y rechaza lo que no se audita. */
export function parseAuditUrl(input: string): URL {
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 2048) {
    throw new AuditError('invalid_url', 'Escribe una URL de entre 1 y 2048 caracteres.');
  }
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AuditError('invalid_url', `«${raw}» no es una URL válida.`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AuditError('invalid_url', 'Solo se auditan direcciones http:// o https://.');
  }
  if (url.username !== '' || url.password !== '') {
    throw new AuditError('invalid_url', 'La URL no puede llevar usuario ni contraseña.');
  }
  if (url.hostname === '') {
    throw new AuditError('invalid_url', 'A la URL le falta el dominio.');
  }
  url.hash = '';
  return url;
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

/**
 * Resuelve el host y devuelve sus direcciones solo si todas son públicas. Lanza `blocked_host` si el
 * nombre es local o alguna dirección es reservada, y `navigation_failed` si el DNS no responde.
 */
export async function resolvePublic(hostname: string): Promise<ResolvedAddress[]> {
  const host = stripBrackets(hostname);
  const blocked = new AuditError('blocked_host', `La web pública solo audita dominios públicos; «${host}» apunta a una red privada o local.`);
  if (host === 'localhost' || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) throw blocked;
  const family = isIP(host);
  if (family !== 0) {
    if (isReservedAddress(host)) throw blocked;
    return [{ address: host, family }];
  }
  let addresses: ResolvedAddress[];
  try {
    addresses = await lookup(host, { all: true, verbatim: true });
  } catch (cause) {
    throw new AuditError('navigation_failed', `No se pudo resolver el dominio «${host}».`, { cause });
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isReservedAddress(address))) throw blocked;
  return addresses;
}

/** Lanza `blocked_host` si el host es local o resuelve a alguna IP reservada. */
export async function assertPublicHost(hostname: string): Promise<void> {
  await resolvePublic(hostname);
}

/** Cabeceras extra (autenticación, cookies de sesión…) que solo viajan al origen auditado. */
export interface OriginHeaders {
  origin: string;
  headers: Readonly<Record<string, string>>;
}

export interface RequestGuard {
  /** Activa o desactiva el modo de solo lectura. */
  setReadOnly(readOnly: boolean): void;
  /** Peticiones abortadas desde la última llamada a `takeBlocked`. */
  takeBlocked(): number;
  /** Lanza si alguna petición (incluidas las redirecciones) tocó un host no permitido. */
  assertClean(): Promise<void>;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function installRequestGuard(
  context: BrowserContext,
  policy: NetworkPolicy,
  options: { originHeaders?: OriginHeaders | undefined } = {},
): Promise<RequestGuard> {
  const extra = options.originHeaders && {
    origin: options.originHeaders.origin,
    // `request.headers()` llega en minúsculas: así una cabecera no se duplica con otra capitalización.
    headers: Object.fromEntries(Object.entries(options.originHeaders.headers).map(([name, value]) => [name.toLowerCase(), value])),
  };
  let readOnly = false;
  let blocked = 0;
  const verdicts = new Map<string, Promise<boolean>>();
  const observed: Promise<boolean>[] = [];

  const hostAllowed = (hostname: string): Promise<boolean> => {
    if (policy === 'any') return Promise.resolve(true);
    const host = stripBrackets(hostname);
    let verdict = verdicts.get(host);
    if (!verdict) {
      verdict = assertPublicHost(host).then(
        () => true,
        () => false,
      );
      verdicts.set(host, verdict);
    }
    return verdict;
  };

  const abort = async (route: Route): Promise<void> => {
    blocked += 1;
    await route.abort('blockedbyclient');
  };

  await context.route('**/*', async (route: Route) => {
    const request = route.request();
    let url: URL;
    try {
      url = new URL(request.url());
    } catch {
      return abort(route);
    }
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return abort(route);
    if (readOnly && (!SAFE_METHODS.has(request.method()) || request.isNavigationRequest())) return abort(route);
    if (!(await hostAllowed(url.hostname))) return abort(route);
    // Las credenciales nunca salen hacia terceros: solo se añaden a las peticiones del origen auditado.
    if (extra && url.origin === extra.origin) return route.continue({ headers: { ...request.headers(), ...extra.headers } });
    return route.continue();
  });

  if (policy === 'public-only') {
    // `route` no ve los saltos de redirección: se vigilan todas las peticiones emitidas
    // y un solo salto a red privada invalida la auditoría antes de devolver nada.
    context.on('request', (request: Request) => {
      try {
        const { protocol, hostname } = new URL(request.url());
        if (protocol === 'http:' || protocol === 'https:') observed.push(hostAllowed(hostname));
      } catch {
        // URL no analizable: el navegador no llegará a pedirla.
      }
    });
    await context.routeWebSocket(/.*/, async (socket) => {
      let allowed = false;
      try {
        allowed = await hostAllowed(new URL(socket.url()).hostname);
      } catch {
        allowed = false;
      }
      if (allowed) socket.connectToServer();
      else await socket.close({ code: 1008, reason: 'blocked' });
    });
  }

  return {
    setReadOnly(value) {
      readOnly = value;
    },
    takeBlocked() {
      const count = blocked;
      blocked = 0;
      return count;
    },
    async assertClean() {
      const results = await Promise.all(observed);
      if (results.includes(false)) {
        throw new AuditError('blocked_host', 'La página redirigió o cargó recursos desde una red privada; la auditoría se ha detenido.');
      }
    },
  };
}

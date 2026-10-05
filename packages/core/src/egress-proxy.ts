/**
 * Proxy de salida del modo `public-only`: cierra el DNS rebinding.
 *
 * Sin proxy, el motor comprueba el DNS de un host y después el navegador lo vuelve a resolver por su
 * cuenta: entre las dos consultas, un DNS malicioso puede cambiar la respuesta a 10.0.0.1. Con este
 * proxy, Chromium no resuelve nada. Cada conexión se resuelve aquí una sola vez, se valida y se abre
 * contra esa misma IP:
 *
 * - `CONNECT host:puerto` (HTTPS, WebSockets): túnel TCP hacia la IP validada.
 * - Peticiones HTTP absolutas: se reenvían con un `lookup` fijado a la IP validada.
 *
 * Escucha solo en 127.0.0.1. Cada auditoría abre el suyo, así lo que bloquea se le atribuye a ella.
 */
import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { connect, type AddressInfo, type LookupFunction, type Socket } from 'node:net';
import { resolvePublic, type ResolvedAddress } from './network-guard.ts';

export interface EgressProxyOptions {
  /** Resuelve y valida un host; lanza si no se permite. Por defecto, solo direcciones públicas. */
  resolve?: (hostname: string) => Promise<ResolvedAddress[]>;
}

export interface EgressProxy {
  /** `http://127.0.0.1:puerto`, para `proxy.server` de Playwright. */
  readonly url: string;
  /** Conexiones rechazadas desde que arrancó. */
  readonly blocked: number;
  close(): Promise<void>;
}

/** Cabeceras de salto a salto: no se reenvían (RFC 9110, 7.6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'proxy-connection',
  'keep-alive',
  'proxy-authorization',
  'proxy-authenticate',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const forwardable = (headers: IncomingHttpHeaders): IncomingHttpHeaders =>
  Object.fromEntries(Object.entries(headers).filter(([name]) => !HOP_BY_HOP.has(name.toLowerCase())));

/** `host:puerto`, con IPv6 entre corchetes. */
function splitAuthority(authority: string): { host: string; port: number } | null {
  const match = /^\[?([^\]]+?)\]?:(\d{1,5})$/.exec(authority);
  const port = Number(match?.[2]);
  if (!match?.[1] || !Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return { host: match[1], port };
}

/** `lookup` que devuelve siempre la dirección ya validada, sin volver a consultar el DNS. */
const pinned = ({ address, family }: ResolvedAddress): LookupFunction =>
  ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (options?.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  }) as unknown as LookupFunction;

export async function startEgressProxy(options: EgressProxyOptions = {}): Promise<EgressProxy> {
  const resolve = options.resolve ?? resolvePublic;
  let blocked = 0;
  const sockets = new Set<Socket>();

  const refuse = (socket: Socket, status: string) => {
    blocked += 1;
    if (!socket.destroyed) socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  };

  const server: Server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void forward(request, response);
  });

  async function forward(request: IncomingMessage, response: ServerResponse) {
    let target: URL;
    try {
      target = new URL(request.url ?? '');
    } catch {
      blocked += 1;
      response.writeHead(400).end();
      return;
    }
    if (target.protocol !== 'http:') {
      blocked += 1;
      response.writeHead(400).end();
      return;
    }
    let address: ResolvedAddress | undefined;
    try {
      [address] = await resolve(target.hostname);
    } catch {
      address = undefined;
    }
    if (!address) {
      blocked += 1;
      response.writeHead(403, { 'content-type': 'text/plain' }).end('LupA11y: destino no permitido');
      return;
    }
    const upstream = httpRequest({
      hostname: target.hostname.replace(/^\[(.*)\]$/, '$1'),
      port: target.port || 80,
      path: `${target.pathname}${target.search}`,
      method: request.method,
      headers: forwardable(request.headers),
      lookup: pinned(address),
    });
    upstream.on('response', (incoming) => {
      response.writeHead(incoming.statusCode ?? 502, incoming.statusMessage, forwardable(incoming.headers));
      incoming.pipe(response);
    });
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502).end();
      else response.destroy();
    });
    request.pipe(upstream);
  }

  server.on('connect', (request: IncomingMessage, client: Socket, head: Buffer) => {
    sockets.add(client);
    client.on('close', () => sockets.delete(client));
    client.on('error', () => client.destroy());
    const authority = splitAuthority(request.url ?? '');
    if (!authority) {
      refuse(client, '400 Bad Request');
      return;
    }
    resolve(authority.host).then(
      ([address]) => {
        if (!address) {
          refuse(client, '403 Forbidden');
          return;
        }
        const upstream = connect({ host: address.address, port: authority.port, family: address.family });
        sockets.add(upstream);
        upstream.on('close', () => sockets.delete(upstream));
        upstream.once('connect', () => {
          client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head.length > 0) upstream.write(head);
          upstream.pipe(client);
          client.pipe(upstream);
        });
        upstream.on('error', () => {
          if (!client.destroyed) client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
          upstream.destroy();
        });
        client.on('close', () => upstream.destroy());
      },
      () => refuse(client, '403 Forbidden'),
    );
  });

  // Chromium tuneliza los WebSockets con CONNECT; un `Upgrade` directo al proxy no se acepta.
  server.on('upgrade', (_request: IncomingMessage, socket: Socket) => refuse(socket, '400 Bad Request'));
  server.on('connection', (socket: Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => done());
  });
  server.unref();
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    get blocked() {
      return blocked;
    },
    close: () =>
      new Promise<void>((done) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => done());
      }),
  };
}

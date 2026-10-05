/**
 * Un Chromium compartido entre auditorías (la API web y el servidor MCP).
 *
 * Arrancar Chromium cuesta entre medio segundo y dos; reutilizarlo hace que la segunda auditoría
 * empiece al momento. Cada auditoría abre su propio contexto aislado, así que no comparten cookies
 * ni almacenamiento. Tras `maxUses` auditorías el navegador se jubila: el siguiente `acquire` arranca
 * uno nuevo y el viejo se cierra cuando termina la última auditoría que lo usaba. Así un proceso de
 * larga vida no acumula la memoria que Chromium va reteniendo.
 */
import { chromium, type Browser, type LaunchOptions } from 'playwright';
import { AuditError } from './errors.ts';

/**
 * Argumentos para servicios expuestos a Internet: WebRTC solo puede salir por el proxy, así una
 * página no abre conexiones UDP hacia la red interna saltándose la política de red.
 */
export const PUBLIC_BROWSER_ARGS = ['--force-webrtc-ip-handling-policy=disable_non_proxied_udp'];

export interface BrowserLease {
  browser: Browser;
  release(): void;
}

export interface BrowserPool {
  acquire(): Promise<BrowserLease>;
  close(): Promise<void>;
}

interface Slot {
  browser: Promise<Browser>;
  uses: number;
  active: number;
  retired: boolean;
}

export function createBrowserPool(options: { launch?: LaunchOptions; maxUses?: number } = {}): BrowserPool {
  const maxUses = options.maxUses ?? 40;
  let current: Slot | null = null;
  const slots = new Set<Slot>();

  const retire = (slot: Slot) => {
    slot.retired = true;
    if (current === slot) current = null;
    if (slot.active === 0) {
      slots.delete(slot);
      void slot.browser.then((browser) => browser.close()).catch(() => undefined);
    }
  };

  const launch = (): Slot => {
    const slot: Slot = {
      browser: chromium.launch({ headless: true, ...options.launch }).catch((cause: unknown) => {
        retire(slot);
        throw new AuditError('browser_unavailable', 'No se pudo arrancar Chromium. Instálalo con «npx playwright install chromium».', { cause });
      }),
      uses: 0,
      active: 0,
      retired: false,
    };
    slots.add(slot);
    void slot.browser.then(
      (browser) => browser.on('disconnected', () => retire(slot)),
      () => undefined,
    );
    return slot;
  };

  return {
    async acquire() {
      if (!current || current.retired || current.uses >= maxUses) {
        if (current) retire(current);
        current = launch();
      }
      const slot = current;
      slot.uses += 1;
      slot.active += 1;
      const done = () => {
        slot.active -= 1;
        if (slot.retired && slot.active === 0) retire(slot);
      };
      let browser: Browser;
      try {
        browser = await slot.browser;
      } catch (error) {
        done();
        throw error;
      }
      let released = false;
      return {
        browser,
        release() {
          if (released) return;
          released = true;
          done();
        },
      };
    },
    async close() {
      const all = [...slots];
      slots.clear();
      current = null;
      await Promise.all(all.map((slot) => slot.browser.then((browser) => browser.close()).catch(() => undefined)));
    },
  };
}

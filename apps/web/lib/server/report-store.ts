/**
 * Informes guardados para compartirlos por enlace (`/r/<id>`).
 *
 * Desactivado salvo que se configure `LUPA11Y_REPORTS_DIR`: guardar capturas de webs ajenas es una
 * decisión de quien despliega, no un efecto secundario. Solo se guardan los informes que produce la
 * propia API (nadie puede subir uno inventado), con un id aleatorio de 128 bits imposible de adivinar
 * y una caducidad (`LUPA11Y_REPORTS_TTL_DAYS`, 7 días por defecto).
 *
 * Es un almacén en disco: sirve en un contenedor con un volumen. En una plataforma sin disco
 * persistente, la misma interfaz se implementa sobre un almacén de objetos.
 */
import { randomBytes } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseReport, type Report } from '@lupa11y/core/schema';

export interface ReportStore {
  save(report: Report): Promise<string>;
  load(id: string): Promise<Report | null>;
}

const ID = /^[\w-]{22}$/;
const HOUR = 3_600_000;

export function createFileStore(dir: string, ttlMs: number): ReportStore {
  let lastSweep = 0;
  // Los últimos informes leídos: una página pide la captura y una docena de recortes del mismo.
  const recent = new Map<string, Report>();

  const sweep = async (now: number) => {
    if (now - lastSweep < HOUR) return;
    lastSweep = now;
    for (const name of await readdir(dir)) {
      if (!name.endsWith('.json')) continue;
      const path = join(dir, name);
      const info = await stat(path).catch(() => null);
      if (info && now - info.mtimeMs > ttlMs) await rm(path, { force: true });
    }
  };

  return {
    async save(report) {
      await mkdir(dir, { recursive: true });
      const id = randomBytes(16).toString('base64url');
      const path = join(dir, `${id}.json`);
      // Escritura atómica: nadie lee nunca un informe a medias.
      await writeFile(`${path}.tmp`, JSON.stringify(report));
      await rename(`${path}.tmp`, path);
      void sweep(Date.now()).catch(() => undefined);
      return id;
    },
    async load(id) {
      if (!ID.test(id)) return null;
      const hit = recent.get(id);
      if (hit) return hit;
      const path = join(dir, `${id}.json`);
      try {
        const info = await stat(path);
        if (Date.now() - info.mtimeMs > ttlMs) {
          await rm(path, { force: true });
          return null;
        }
        const report = parseReport(JSON.parse(await readFile(path, 'utf8')));
        recent.set(id, report);
        if (recent.size > 8) recent.delete(recent.keys().next().value ?? '');
        return report;
      } catch {
        return null;
      }
    },
  };
}

let store: ReportStore | null | undefined;

/** El almacén configurado, o `null` si los enlaces permanentes están desactivados. */
export function reportStore(env: Record<string, string | undefined> = process.env): ReportStore | null {
  if (store !== undefined) return store;
  const dir = env['LUPA11Y_REPORTS_DIR']?.trim();
  const days = Number.parseInt(env['LUPA11Y_REPORTS_TTL_DAYS'] ?? '', 10);
  store = dir ? createFileStore(dir, (Number.isInteger(days) && days > 0 ? days : 7) * 24 * HOUR) : null;
  return store;
}

/**
 * Orquestador: carga → axe → zoom y espaciado → teclado → visión → informe validado.
 *
 * Solo la carga es fatal. Si otra fase falla, queda marcada como `failed` y el informe
 * sigue siendo válido con lo que sí se midió. El informe se valida contra el esquema Zod
 * antes de salir: un informe que no cumple el contrato es un bug del motor, no algo que
 * se entrega al consumidor.
 *
 * La visión no espera a nadie más de lo necesario: los textos alternativos y los parches solo
 * dependen de axe, así que salen hacia el modelo en cuanto axe termina y trabajan mientras el
 * agente tabula. Solo los focos dudosos esperan al agente.
 */
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from 'playwright';
import { PUBLIC_BROWSER_ARGS } from './browser-pool.ts';
import { PixelLab, toDataUrl } from './browser/evidence.ts';
import { runtime, type PageFacts } from './browser/page-runtime.ts';
import { startEgressProxy, type EgressProxy } from './egress-proxy.ts';
import { AuditError, toAuditError } from './errors.ts';
import { sortFindings } from './findings.ts';
import { OUTCOME_LABEL } from './format.ts';
import { assertPublicHost, installRequestGuard, parseAuditUrl, type NetworkPolicy } from './network-guard.ts';
import { runAxePhase } from './phases/axe.ts';
import { runKeyboardPhase, weakFocusFindings, type KeyboardPhaseResult } from './phases/keyboard.ts';
import { runLayoutPhase } from './phases/layout.ts';
import {
  applyNodePatches,
  collectImageSamples,
  DEFAULT_VISION_MODEL,
  judgeAltTexts,
  judgeWeakFocus,
  openVisionSession,
  proposePatches,
  type ImageSample,
  type NodePatch,
  type VisionAsker,
} from './phases/vision.ts';
import {
  PHASES,
  Report,
  SCHEMA_VERSION,
  SEVERITIES,
  SOURCES,
  type AuditEvent,
  type Finding,
  type KeyboardMap,
  type PhaseId,
  type PhaseResult,
} from './schema.ts';

export interface AuditOptions {
  /** `public-only` para servicios expuestos a Internet. Por defecto `any` (CLI, MCP). */
  network?: NetworkPolicy;
  /** Nivel de conformidad que se audita. Por defecto AA, el que exige la EN 301 549. */
  level?: 'AA' | 'AAA';
  viewport?: { width: number; height: number };
  /** Presupuesto total en milisegundos. Por defecto 120 000. */
  timeoutMs?: number;
  keyboard?: false | { maxStops?: number };
  /** `false` omite la fase de zoom y espaciado (WCAG 1.4.10 y 1.4.12). */
  layout?: boolean;
  /**
   * Por defecto usa `GEMINI_API_KEY`, `LUPA11Y_VISION_MODEL`, `LUPA11Y_VISION_FALLBACK_MODEL`,
   * `LUPA11Y_VISION_MAX_CALLS` y `LUPA11Y_VISION_RPM` del entorno. `false` la desactiva. `rpm` fija un
   * ritmo de peticiones por minuto y `fallbackModel` es el modelo de reserva si el principal está
   * saturado (útiles con el plan gratuito de Google AI Studio). `client` sustituye a Gemini (otro
   * proveedor o un doble en los tests).
   */
  vision?: false | { apiKey?: string; model?: string; fallbackModel?: string; maxCalls?: number; rpm?: number; client?: VisionAsker };
  /** Alto máximo de la captura de página completa, en píxeles CSS. */
  screenshotMaxHeight?: number;
  /** Navegador ya arrancado (p. ej. de un `BrowserPool`). Si no se pasa, se lanza uno y se cierra al acabar. */
  browser?: Browser;
  /** Sesión de Playwright (cookies y `localStorage`) para auditar páginas que exigen iniciar sesión. */
  storageState?: BrowserContextOptions['storageState'];
  /** Cabeceras que se añaden a las peticiones del origen auditado, y solo a esas. */
  headers?: Record<string, string>;
  /**
   * `false` en servicios públicos: un fallo interno se comunica sin detalles (rutas, mensajes de
   * librerías). El detalle completo llega a `onInternalError`. Por defecto `true`.
   */
  exposeInternalErrors?: boolean;
  /** Recibe cada error interno con su detalle, para registrarlo. `phase` es null si fue fatal. */
  onInternalError?: (error: unknown, phase: PhaseId | null) => void;
  signal?: AbortSignal;
  onEvent?: (event: AuditEvent) => void;
}

const DEFAULT_VIEWPORT = { width: 1280, height: 800 };

async function settle(page: Page, maxHeight: number): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined);
  // Recorre la página una vez para que carguen las imágenes diferidas y vuelve arriba.
  await page.evaluate(async (limit) => {
    const bottom = Math.min(document.documentElement.scrollHeight, limit);
    for (let y = 0; y < bottom; y += innerHeight) {
      scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    scrollTo(0, 0);
  }, maxHeight);
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

interface ResolvedVision {
  apiKey: string;
  model: string;
  fallbackModel: string | null;
  maxCalls: number;
  rpm: number | null;
  client: VisionAsker | undefined;
}

/** Entero positivo de una variable de entorno, o null. */
const envNumber = (name: string): number | null => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(value) && value > 0 ? value : null;
};

function resolveVision(option: AuditOptions['vision']): ResolvedVision | null {
  if (option === false) return null;
  // `||` y no `??`: una línea `VARIABLE=` vacía en un .env cuenta como no puesta.
  const apiKey = option?.apiKey || process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || '';
  if (!apiKey && !option?.client) return null;
  return {
    apiKey,
    model: option?.model || process.env['LUPA11Y_VISION_MODEL'] || DEFAULT_VISION_MODEL,
    fallbackModel: option?.fallbackModel || process.env['LUPA11Y_VISION_FALLBACK_MODEL'] || null,
    maxCalls: option?.maxCalls ?? envNumber('LUPA11Y_VISION_MAX_CALLS') ?? 14,
    rpm: option?.rpm ?? envNumber('LUPA11Y_VISION_RPM'),
    client: option?.client,
  };
}

/** Los hallazgos parciales viajan sin imágenes: el informe final las trae todas. */
const lightweight = (findings: readonly Finding[]): Finding[] =>
  findings.map((f) => ({ ...f, nodes: f.nodes.map((n) => ({ ...n, evidence: { crop: null, unfocused: null, focused: null } })) }));

/** Promesa que nunca rechaza: para tareas que corren en segundo plano mientras otra fase trabaja. */
const settled = <T>(promise: Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

export async function audit(input: string, options: AuditOptions = {}): Promise<Report> {
  const startedAt = new Date();
  const t0 = performance.now();
  const emit = (event: AuditEvent) => {
    try {
      options.onEvent?.(event);
    } catch {
      // Un consumidor que falla al pintar no puede tumbar la auditoría.
    }
  };
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 120_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const policy = options.network ?? 'any';
  const level = options.level ?? 'AA';
  const viewport = options.viewport ?? DEFAULT_VIEWPORT;
  const maxHeight = options.screenshotMaxHeight ?? 6_000;
  const vision = resolveVision(options.vision);
  const expose = options.exposeInternalErrors ?? true;

  let browser: Browser | null = options.browser ?? null;
  const ownsBrowser = browser === null;
  let context: BrowserContext | null = null;
  let lab: PixelLab | null = null;
  let proxy: EgressProxy | null = null;
  const closeOnAbort = () => void context?.close().catch(() => undefined);
  signal.addEventListener('abort', closeOnAbort, { once: true });

  const phases: PhaseResult[] = [];
  const log = (phase: PhaseId) => (message: string) => emit({ type: 'log', phase, message });

  /** Mensaje de un fallo apto para quien mira: con detalle en local, sin él en un servicio público. */
  const describe = (error: unknown): string => {
    if (error instanceof AuditError) return error.message;
    if (!expose) return 'error interno (registrado para revisarlo)';
    return error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
  };

  /** Abre una fase: emite `running` y devuelve cómo cerrarla. */
  const open = (id: PhaseId, running: string) => {
    signal.throwIfAborted();
    emit({ type: 'phase', phase: id, state: 'running', message: running });
    const start = performance.now();
    return {
      done(note: string, waitedMs = 0) {
        phases.push({ id, status: 'done', durationMs: Math.round(performance.now() - start), ...(waitedMs > 0 ? { waitedMs: Math.round(waitedMs) } : {}), note });
        emit({ type: 'phase', phase: id, state: 'done', message: note });
      },
      failed(error: unknown) {
        signal.throwIfAborted();
        if (!(error instanceof AuditError)) options.onInternalError?.(error, id);
        const note = `La fase falló: ${describe(error)}`;
        phases.push({ id, status: 'failed', durationMs: Math.round(performance.now() - start), note });
        emit({ type: 'phase', phase: id, state: 'failed', message: note });
      },
    };
  };

  /** Ejecuta una fase no fatal: si falla, la marca y sigue. */
  async function phase<T>(id: PhaseId, running: string, work: () => Promise<T>, summary: (value: T) => string): Promise<T | null> {
    const handle = open(id, running);
    try {
      const value = await work();
      handle.done(summary(value));
      return value;
    } catch (error) {
      handle.failed(error);
      return null;
    }
  }

  const skip = (id: PhaseId, note: string) => {
    phases.push({ id, status: 'skipped', durationMs: 0, note });
    emit({ type: 'phase', phase: id, state: 'skipped', message: note });
  };

  const partial = (id: PhaseId, findings: readonly Finding[], keyboard: KeyboardMap | null = null) =>
    emit({ type: 'partial', phase: id, findings: lightweight(findings), keyboard });

  try {
    const url = parseAuditUrl(input);

    // Carga (fatal)
    emit({ type: 'phase', phase: 'load', state: 'running', message: `Arrancando Chromium headless y cargando ${url.host}…` });
    const loadStart = performance.now();
    if (policy === 'public-only') await assertPublicHost(url.hostname);
    if (!browser) {
      try {
        browser = await chromium.launch({ headless: true, args: policy === 'public-only' ? PUBLIC_BROWSER_ARGS : [] });
      } catch (cause) {
        throw new AuditError('browser_unavailable', 'No se pudo arrancar Chromium. Instálalo con «npx playwright install chromium».', { cause });
      }
    }
    // En modo público, Chromium no resuelve DNS: todo sale por el proxy, que valida cada conexión.
    // `<-loopback>` anula la excepción implícita de Chromium para localhost: también pasa por el proxy.
    // Un proxy por auditoría: así lo que bloquea se atribuye a esta y no a otra simultánea.
    if (policy === 'public-only') proxy = await startEgressProxy();
    context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      locale: 'es-ES',
      serviceWorkers: 'block',
      acceptDownloads: false,
      colorScheme: 'light',
      ...(proxy ? { proxy: { server: proxy.url, bypass: '<-loopback>' } } : {}),
      ...(options.storageState ? { storageState: options.storageState } : {}),
    });
    const guard = await installRequestGuard(context, policy, {
      originHeaders: options.headers && Object.keys(options.headers).length > 0 ? { origin: url.origin, headers: options.headers } : undefined,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const egress = proxy;
    const assertEgressClean = (cause?: unknown) => {
      if (egress && egress.blocked > 0) {
        throw new AuditError('blocked_host', 'La página, una redirección o un recurso apuntan a una red privada; la auditoría se ha detenido.', { cause });
      }
    };
    let response: Awaited<ReturnType<Page['goto']>>;
    try {
      response = await page.goto(url.href, { waitUntil: 'load', timeout: 30_000 });
    } catch (cause) {
      signal.throwIfAborted();
      assertEgressClean(cause);
      throw new AuditError('navigation_failed', `No se pudo cargar la página: ${cause instanceof Error ? cause.message.split('\n')[0] : cause}`, { cause });
    }
    assertEgressClean();
    if (response && response.status() >= 400) {
      throw new AuditError('navigation_failed', `La página respondió con un error HTTP ${response.status()}.`);
    }
    await settle(page, maxHeight);
    await guard.assertClean();
    assertEgressClean();
    const facts: PageFacts = await runtime.facts(page.mainFrame());
    const shotHeight = Math.max(1, Math.min(facts.scrollHeight, maxHeight));
    const shot = await page.screenshot({
      fullPage: true,
      clip: { x: 0, y: 0, width: viewport.width, height: shotHeight },
      type: 'jpeg',
      quality: 70,
      animations: 'disabled',
      caret: 'hide',
      timeout: 20_000,
    });
    const screenshot = { image: toDataUrl(shot, 'jpeg'), width: viewport.width, height: shotHeight, truncated: facts.scrollHeight > maxHeight };
    const loadNote = `«${facts.title || 'sin título'}» cargada: ${viewport.width}×${facts.scrollHeight} px${facts.lang ? `, lang="${facts.lang}"` : ', sin atributo lang'}.`;
    phases.push({ id: 'load', status: 'done', durationMs: Math.round(performance.now() - loadStart), note: loadNote });
    emit({ type: 'phase', phase: 'load', state: 'done', message: loadNote });
    emit({ type: 'capture', url: url.href, finalUrl: page.url(), title: facts.title, viewport, wcagLevel: level, screenshot });
    const documentSize = { width: Math.max(viewport.width, facts.scrollWidth), height: Math.max(1, facts.scrollHeight) };

    // Fase 1: axe-core
    const axeResult = await phase(
      'axe',
      `Inyectando axe-core y evaluando WCAG 2.2 ${level}…`,
      () => runAxePhase(page, level, { viewport, document: documentSize }, log('axe')),
      ({ findings }) => `${findings.length} reglas incumplidas en ${findings.reduce((n, f) => n + f.occurrences, 0)} nodos.`,
    );
    const axeFindings = axeResult?.findings ?? [];
    partial('axe', axeFindings);

    // Las imágenes se recortan con la página intacta: las fases siguientes cambian la ventana y abren menús.
    let images: ImageSample[] = [];
    if (vision) {
      images = await collectImageSamples(page, 6, documentSize).catch(() => []);
      if (images.length > 0) log('axe')(`${images.length} imágenes recortadas para la fase de visión.`);
    }

    // Fase 3, primera mitad: sale hacia el modelo ya, en paralelo con las fases siguientes.
    const visionRun = vision
      ? (() => {
          const handle = open('vision', `Consultando ${vision.model} en paralelo: textos alternativos y correcciones…`);
          const session = openVisionSession(
            {
              apiKey: vision.apiKey,
              model: vision.model,
              fallbackModel: vision.fallbackModel,
              maxCalls: vision.maxCalls,
              rpm: vision.rpm,
              // Esperar por cuota nunca puede tumbar la auditoría: 10 s antes del límite, se cierra con lo que haya.
              deadline: startedAt.getTime() + (options.timeoutMs ?? 120_000) - 10_000,
              level,
              signal,
              log: log('vision'),
            },
            vision.client,
          );
          return {
            handle,
            session,
            alt: settled(judgeAltTexts(session, { images, pageTitle: facts.title, axeFindings })),
            patches: settled(proposePatches(session, axeFindings)),
          };
        })()
      : null;

    // Fase 2: zoom y espaciado
    let layoutFindings: Finding[] = [];
    if (options.layout === false) {
      skip('layout', 'Desactivada en las opciones.');
    } else {
      const layout = await phase(
        'layout',
        'Reflujo a 320 px y espaciado de texto de WCAG 1.4.12…',
        () => runLayoutPhase(page, { viewport, signal, log: log('layout') }),
        ({ findings, scrollWidth, clipped }) =>
          findings.length === 0
            ? 'El contenido cabe a 320 px y el espaciado de texto no recorta nada.'
            : `A 320 px el documento mide ${scrollWidth} px de ancho; ${clipped} textos recortados con el espaciado de WCAG.`,
      );
      layoutFindings = layout?.findings ?? [];
      partial('layout', layoutFindings);
    }

    // Fase 3: agente de teclado
    let keyboard: KeyboardPhaseResult | null = null;
    if (options.keyboard === false) {
      skip('keyboard', 'Desactivada en las opciones.');
    } else {
      lab = await PixelLab.open(browser);
      const activeLab = lab;
      keyboard = await phase(
        'keyboard',
        'Agente de teclado: pulsando Tab y midiendo el foco píxel a píxel…',
        () =>
          runKeyboardPhase(page, guard, activeLab, {
            maxStops: options.keyboard ? (options.keyboard.maxStops ?? 60) : 60,
            level,
            viewport,
            signal,
            log: log('keyboard'),
          }),
        ({ map }) => `${map.stops.length} paradas de foco · ${OUTCOME_LABEL[map.outcome]}.`,
      );
      partial('keyboard', keyboard?.findings ?? [], keyboard?.map ?? null);
    }

    // Fase 4: visión, segunda mitad (los focos dudosos) y cierre.
    const weak = keyboard?.weak ?? [];
    let patchedAxe = axeFindings;
    const visionFindings: Finding[] = [];
    if (!visionRun) {
      skip('vision', 'Sin GEMINI_API_KEY: la fase de visión no se ejecuta y los focos débiles quedan pendientes de revisión.');
      visionFindings.push(...weakFocusFindings(weak, null, level));
    } else {
      const focus = await settled(judgeWeakFocus(visionRun.session, weak));
      const [alt, patches] = await Promise.all([visionRun.alt, visionRun.patches]);
      const failure = [alt, patches, focus].find((result) => !result.ok);
      if (failure && !failure.ok) {
        visionRun.handle.failed(failure.error);
        visionFindings.push(...weakFocusFindings(weak, null, level));
      } else {
        const verdicts = focus.ok ? focus.value : null;
        const altFindings = alt.ok ? alt.value.findings : [];
        const nodePatches: NodePatch[] = [...(alt.ok ? alt.value.patches : []), ...(patches.ok ? patches.value : [])];
        patchedAxe = applyNodePatches(axeFindings, nodePatches);
        const weakFound = weakFocusFindings(weak, verdicts, level);
        visionFindings.push(...altFindings, ...weakFound);
        const fresh = altFindings.length + weakFound.filter((f) => f.source === 'vision').length;
        const waited = visionRun.session.client.waitedMs ?? 0;
        visionRun.handle.done(
          `${visionRun.session.client.calls} consultas al modelo · ${fresh} hallazgos nuevos · ${nodePatches.length} arreglos propuestos${
            waited >= 1_000 ? ` · ${Math.round(waited / 1000)} s esperando la cuota de Google` : ''
          }.`,
          waited,
        );
      }
    }

    await guard.assertClean();
    assertEgressClean();

    const sorted = sortFindings([...patchedAxe, ...layoutFindings, ...(keyboard?.findings ?? []), ...visionFindings]);
    const order = (id: PhaseId) => PHASES.indexOf(id);
    const report = Report.parse({
      schemaVersion: SCHEMA_VERSION,
      url: url.href,
      finalUrl: page.url(),
      title: facts.title,
      lang: facts.lang,
      auditedAt: startedAt.toISOString(),
      durationMs: Math.round(performance.now() - t0),
      viewport,
      wcagLevel: level,
      engines: { axe: axeResult?.version ?? 'no disponible', browser: `Chromium ${browser.version()}`, visionModel: vision ? (visionRun?.session.client.models?.join(' + ') || vision.model) : null },
      phases: [...phases].sort((a, b) => order(a.id) - order(b.id)),
      summary: {
        total: sorted.length,
        bySeverity: Object.fromEntries(SEVERITIES.map((s) => [s, sorted.filter((f) => f.severity === s).length])),
        bySource: Object.fromEntries(SOURCES.map((s) => [s, sorted.filter((f) => f.source === s).length])),
      },
      screenshot,
      keyboard: keyboard?.map ?? null,
      findings: sorted,
    });
    emit({ type: 'result', report });
    return report;
  } catch (error) {
    const failure = toAuditError(error, signal);
    if (failure.code === 'internal') options.onInternalError?.(error, null);
    const visible =
      failure.code === 'internal' && !expose
        ? new AuditError('internal', 'Fallo interno del motor. Ha quedado registrado para revisarlo.', { cause: failure })
        : failure;
    emit({ type: 'error', code: visible.code, message: visible.message });
    throw visible;
  } finally {
    signal.removeEventListener('abort', closeOnAbort);
    await lab?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await proxy?.close().catch(() => undefined);
    if (ownsBrowser) await browser?.close().catch(() => undefined);
  }
}

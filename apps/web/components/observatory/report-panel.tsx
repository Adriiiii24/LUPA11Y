'use client';

/**
 * El informe completo: lecturas arriba, la captura a la izquierda y el panel a la derecha, todo en
 * un mismo cuerpo de radios grandes. Una curva luminosa cose la fila activa del panel con su caja en
 * la captura.
 *
 * Mientras se audita, la captura llega con la carga y las cajas aparecen fase a fase. Al terminar,
 * si ya se había auditado la misma página, dice qué cambió; y el informe se puede descargar.
 */
import type { ReportComparison } from '@lupa11y/core/compare';
import { OUTCOME_LABEL, PHASE_STATUS_LABEL, SEVERITY_LABEL } from '@lupa11y/core/format';
import { SEVERITIES, type Report } from '@lupa11y/core/schema';
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { downloadJson, downloadSarif, markdownOf } from '@/lib/export-report';
import { useCopy } from '@/lib/use-copy';
import { IconCheck, IconCopy } from '../icons';
import { Tabs } from '../tabs';
import { CaptureViewport } from './capture-viewport';
import { ConsolePanel, type ConsoleLine } from './console-panel';
import { FindingsPanel } from './findings-panel';
import { KeyboardPanel } from './keyboard-panel';
import { PALETTE, tint } from '../palette';
import { CAPTURE_GLOW, CAPTURE_ROUTE, CAPTURE_STITCH, findingIdOf, formatMs, type Target } from './model';
import { SeverityTag } from './severity';
import type { DockTab, ViewActions, ViewState } from './view-state';

export type PanelStatus = 'idle' | 'running' | 'done' | 'error';

interface ReportPanelProps {
  report: Report;
  targets: Target[];
  view: ViewState;
  actions: ViewActions;
  activeKey: string | null;
  viewportRef: RefObject<HTMLDivElement | null>;
  status: PanelStatus;
  /** La URL que se audita, mientras aún no hay captura. */
  pendingUrl: string | null;
  log: { lines: ConsoleLine[]; live: boolean };
  /** Qué se está viendo: la muestra, una auditoría en directo, un informe guardado… */
  caption: string;
  comparison?: ReportComparison | null;
  /** Lo que se puede llevar: el informe y, si el servidor lo guardó, su enlace. */
  share?: { savedPath: string | null } | null;
}

export function ReportPanel({ report, targets, view, actions, activeKey, viewportRef, status, pendingUrl, log, caption, comparison = null, share = null }: ReportPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const leaderRef = useRef<SVGGElement>(null);
  const running = status === 'running';
  const vision = report.phases.find((p) => p.id === 'vision');
  const newIds = comparison
    ? new Set([...comparison.added.map((f) => f.id), ...comparison.changed.filter((c) => c.newNodes.length > 0).map((c) => c.finding.id)])
    : undefined;

  // La costura: una curva del borde del panel (derecha) a la caja activa en la captura (izquierda).
  // Devuelve una firma de lo dibujado para saber cuándo ha dejado de moverse.
  const drawLeader = useCallback((): string => {
    const group = leaderRef.current;
    const body = bodyRef.current;
    const capture = viewportRef.current;
    if (!group || !body) return 'none';
    const hide = () => {
      group.setAttribute('opacity', '0');
      return 'hidden';
    };
    if (!capture || !activeKey || status === 'error' || !window.matchMedia('(min-width: 1024px)').matches) return hide();
    const panel = dockRef.current?.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])');
    const findingId = findingIdOf(activeKey) ?? '';
    const item =
      panel?.querySelector<HTMLElement>(`[data-item-key="${CSS.escape(activeKey)}"]`) ??
      panel?.querySelector<HTMLElement>(`[data-item-key^="${CSS.escape(findingId)}#"]`);
    const box = capture.querySelector<HTMLElement>(`[data-box-key="${CSS.escape(activeKey)}"]`);
    if (!panel || !item || !box) return hide();

    const origin = body.getBoundingClientRect();
    const itemBox = item.getBoundingClientRect();
    const panelBox = panel.getBoundingClientRect();
    const target = box.getBoundingClientRect();
    const viewBox = capture.getBoundingClientRect();
    const itemY = Math.min(Math.max(itemBox.top + 34, panelBox.top + 8), panelBox.bottom - 8);
    const targetY = target.top + target.height / 2;
    const itemVisible = itemBox.bottom > panelBox.top + 8 && itemBox.top < panelBox.bottom - 8;
    const targetVisible = targetY > viewBox.top + 12 && targetY < viewBox.bottom - 12;
    if (!itemVisible || !targetVisible) return hide();

    const x1 = itemBox.left - origin.left + 6;
    const x2 = Math.min(target.right, viewBox.right - 6) - origin.left;
    const y1 = itemY - origin.top;
    const y2 = targetY - origin.top;
    const pull = Math.max(40, (x1 - x2) * 0.45);
    const d = `M${x1} ${y1} C${x1 - pull} ${y1}, ${x2 + pull} ${y2}, ${x2} ${y2}`;
    group.querySelectorAll('path').forEach((path) => path.setAttribute('d', d));
    const [start, end] = group.querySelectorAll('circle');
    start?.setAttribute('cx', String(x1));
    start?.setAttribute('cy', String(y1));
    end?.setAttribute('cx', String(x2));
    end?.setAttribute('cy', String(y2));
    group.setAttribute('opacity', '1');
    return d;
  }, [activeKey, status, viewportRef]);

  // Se redibuja en cada fotograma mientras algo se mueva (scroll suave, filas que entran) y se para
  // cuando la curva lleva unos fotogramas quieta. Sin temporizadores a ojo.
  useEffect(() => {
    let frame = 0;
    let still = 0;
    let last = '';
    let until = 0;
    const tick = () => {
      const signature = drawLeader();
      still = signature === last ? still + 1 : 0;
      last = signature;
      if (still < 12 && performance.now() < until) frame = requestAnimationFrame(tick);
    };
    const kick = () => {
      until = performance.now() + 3_000;
      still = 0;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(tick);
    };
    kick();
    const dock = dockRef.current;
    const capture = viewportRef.current;
    dock?.addEventListener('scroll', kick, { passive: true, capture: true });
    capture?.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    return () => {
      cancelAnimationFrame(frame);
      dock?.removeEventListener('scroll', kick, { capture: true });
      capture?.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
    };
  }, [drawLeader, view.tab, view.visible, viewportRef, report]);

  const waiting = running && !report.screenshot;

  return (
    <div className="shine-strong rounded-[2.5rem] bg-raised p-2 sm:rounded-[3rem] sm:p-3">
      {/* Lecturas: ruta del teclado, filtros por severidad y el cierre de cada fase. */}
      <div className="flex min-w-0 flex-col gap-3 px-2 pb-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:px-3">
        <div className="relative flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-pressed={view.showPath}
            onClick={actions.togglePath}
            className="shine inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-full bg-surface px-4 text-sm text-text-muted transition-colors hover:text-text aria-pressed:bg-surface-2 aria-pressed:text-text"
          >
            <RouteSwatch />
            Ruta de teclado
          </button>
          <div role="group" aria-label="Filtrar por severidad" className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((severity) => (
              <button
                key={severity}
                type="button"
                aria-pressed={view.visible.has(severity)}
                onClick={() => actions.toggleSeverity(severity)}
                className="shine inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-sm transition-[background-color,opacity] hover:bg-surface-2 aria-pressed:bg-surface-2 aria-[pressed=false]:opacity-60 aria-[pressed=false]:[&_*]:line-through"
              >
                <SeverityTag severity={severity} showLabel={false} />
                {SEVERITY_LABEL[severity]}
                <span className="font-mono text-text-muted tabular-nums">{report.summary.bySeverity[severity]}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="px-1 text-sm text-text-muted sm:ml-auto">
          {report.keyboard ? (
            <>
              Teclado: <span className="text-text">{OUTCOME_LABEL[report.keyboard.outcome]}</span>.{' '}
            </>
          ) : null}
          {vision ? (
            <>
              Visión: <span className="text-text">{PHASE_STATUS_LABEL[vision.status]}</span>.
            </>
          ) : null}
        </p>
      </div>

      {comparison ? <ComparisonNote comparison={comparison} /> : null}

      <div ref={bodyRef} className="relative grid grid-cols-[minmax(0,1fr)] gap-2 sm:gap-3 lg:h-[min(48rem,calc(100dvh-9rem))] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] bg-surface sm:rounded-[2.25rem]">
          <Legend />
          {/* La captura va en su propia ventana redondeada; al hacer scroll se funde arriba, sin canto recto. */}
          <div className="relative mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem]">
            {waiting ? (
              <CaptureWaiting url={pendingUrl ?? ''} />
            ) : status === 'error' ? (
              <p className="grid h-full min-h-72 place-items-center p-8 text-center text-text-muted">Sin captura: la auditoría no terminó. La muestra sigue disponible arriba.</p>
            ) : (
              <CaptureViewport
                report={report}
                targets={targets}
                activeKey={activeKey}
                selectedKey={view.selected}
                showPath={view.showPath}
                onSelect={actions.select}
                onHover={actions.hover}
                scrollRef={viewportRef}
              />
            )}
          </div>
        </div>

        <div ref={dockRef} className="flex min-h-0 flex-col rounded-[2rem] bg-surface sm:rounded-[2.25rem]">
          <Tabs<DockTab>
            label="Paneles del informe"
            value={view.tab}
            onChange={actions.setTab}
            className="flex min-h-0 flex-1 flex-col"
            listClassName="m-3 max-w-[calc(100%-1.5rem)] self-start"
            frameClassName="min-h-0 flex-1 rounded-b-[inherit]"
            panelClassName="rounded-b-[2rem] lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:[mask-image:linear-gradient(to_bottom,transparent,#000_1.25rem)]"
            items={[
              {
                id: 'findings',
                label: (
                  <>
                    Hallazgos <span className="font-mono text-text-muted">{report.summary.total}</span>
                  </>
                ),
                content: (
                  <FindingsPanel
                    key={report.auditedAt}
                    report={report}
                    visible={view.visible}
                    activeKey={activeKey}
                    openRequest={view.openRequest}
                    {...(newIds ? { newIds } : {})}
                    onSelect={actions.select}
                    onHover={actions.hover}
                  />
                ),
              },
              {
                id: 'keyboard',
                label: (
                  <>
                    Teclado <span className="font-mono text-text-muted">{report.keyboard?.stops.length ?? 0}</span>
                  </>
                ),
                content: <KeyboardPanel keyboard={report.keyboard} activeKey={activeKey} onSelect={actions.select} onHover={actions.hover} />,
              },
              { id: 'console', label: 'Registro', content: <ConsolePanel lines={log.lines} live={log.live} /> },
            ]}
          />
        </div>

        {/* La costura: una curva azul con halo, de la fila activa a su caja (azul, como las cajas). */}
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 hidden h-full w-full overflow-visible lg:block">
          <g ref={leaderRef} opacity="0" style={{ transition: 'opacity 200ms' }}>
            <path fill="none" stroke={CAPTURE_STITCH} strokeOpacity="0.35" strokeWidth="6" style={{ filter: 'blur(4px)' }} />
            <path fill="none" stroke={tint('bg', 0.9)} strokeWidth="4" strokeLinecap="round" />
            <path fill="none" stroke={CAPTURE_STITCH} strokeWidth="1.5" strokeLinecap="round" />
            <circle r="4" fill={CAPTURE_STITCH} stroke={PALETTE.bg} strokeWidth="2" />
            <circle r="4" fill={CAPTURE_STITCH} stroke={PALETTE.bg} strokeWidth="2" />
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pb-1 pt-4 text-sm text-text-muted">
        <span>{caption}</span>
        {share && !running ? <ShareBar report={report} savedPath={share.savedPath} /> : null}
        <span className="flex flex-wrap gap-1.5 font-mono text-[0.8125rem] sm:ml-auto">
          {[report.durationMs > 0 ? formatMs(report.durationMs) : null, report.engines.browser.replace(/\.\d+\.\d+$/, ''), `axe-core ${report.engines.axe}`, report.engines.visionModel]
            .filter(Boolean)
            .map((item) => (
              <span key={item} className="rounded-full bg-white/5 px-3 py-1">
                {item}
              </span>
            ))}
        </span>
      </div>
    </div>
  );
}

/** Qué cambió desde la auditoría anterior de la misma página, en una frase y con lo nuevo marcado abajo. */
function ComparisonNote({ comparison }: { comparison: ReportComparison }) {
  const worse = comparison.changed.filter((c) => c.newNodes.length > 0 || c.occurrencesAfter > c.occurrencesBefore).length;
  const fixedNodes = comparison.changed.reduce((n, c) => n + c.resolvedNodes.length, 0);
  const parts = [
    `${comparison.resolved.length} ${comparison.resolved.length === 1 ? 'regla resuelta' : 'reglas resueltas'}`,
    `${comparison.added.length} ${comparison.added.length === 1 ? 'nueva' : 'nuevas'}`,
    ...(worse > 0 ? [`${worse} ${worse === 1 ? 'empeora' : 'empeoran'}`] : []),
    ...(fixedNodes > 0 ? [`${fixedNodes} ${fixedNodes === 1 ? 'nodo arreglado' : 'nodos arreglados'}`] : []),
    `${comparison.unchanged.length} ${comparison.unchanged.length === 1 ? 'sigue igual' : 'siguen igual'}`,
  ];
  return (
    <p className="mx-2 mb-3 rounded-[1.5rem] bg-surface px-5 py-3 text-sm text-text-muted shadow-[inset_0_0_0_1px_rgb(var(--azure-rgb)/0.3)] sm:mx-3">
      <span className="font-medium text-text">Frente a la auditoría anterior de esta página: </span>
      {parts.join(' · ')}.
      {comparison.incomparable.length > 0 ? ` ${comparison.incomparable.length} hallazgos de fases que no corrieron en las dos no se comparan.` : ''}
    </p>
  );
}

/** Descargas y copias del informe. El estado de «copiado» también se anuncia. */
function ShareBar({ report, savedPath }: { report: Report; savedPath: string | null }) {
  const { copied, copy } = useCopy();
  const button =
    'inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/6 px-4 text-sm text-text transition-colors hover:bg-white/10 active:scale-[0.98]';
  return (
    <span className="flex flex-wrap gap-1.5" role="group" aria-label="Llevarse el informe">
      <button type="button" className={button} onClick={() => downloadJson(report)}>
        Descargar JSON
      </button>
      <button type="button" className={button} onClick={() => downloadSarif(report)}>
        Descargar SARIF
      </button>
      <button type="button" className={button} onClick={() => copy('markdown', markdownOf(report))}>
        {copied === 'markdown' ? <IconCheck size={16} /> : <IconCopy size={16} />}
        {copied === 'markdown' ? 'Copiado' : 'Copiar Markdown'}
      </button>
      {savedPath ? (
        <button type="button" className={button} onClick={() => copy('link', new URL(savedPath, window.location.origin).href)}>
          {copied === 'link' ? <IconCheck size={16} /> : <IconCopy size={16} />}
          {copied === 'link' ? 'Enlace copiado' : 'Copiar enlace'}
        </button>
      ) : null}
      <span className="visually-hidden" aria-live="polite">
        {copied ? 'Copiado al portapapeles.' : ''}
      </span>
    </span>
  );
}

/** Muestra de la ruta: un tramo curvo con su parada. */
function RouteSwatch() {
  return (
    <svg width="30" height="16" viewBox="0 0 30 16" aria-hidden="true" className="shrink-0">
      <path d="M2 12 C 9 13, 12 3, 20 5" fill="none" stroke={CAPTURE_GLOW} strokeWidth="2" strokeLinecap="round" />
      <circle cx="23" cy="6" r="4" fill="#ffffff" stroke={CAPTURE_ROUTE} strokeWidth="2" />
    </svg>
  );
}

/** Leyenda de la captura: la fase se lee en el estilo de línea, no solo en el color. */
function Legend() {
  const item = (line: string, width: number, label: string) => (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className="h-3.5 w-6 rounded-[6px]" style={{ outline: `${width}px ${line} ${PALETTE.azure}`, outlineOffset: '-1px' }} />
      {label}
    </span>
  );
  return (
    <p className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3 text-sm text-text-muted">
      {item('solid', 1.75, 'axe-core')}
      {item('double', 3, 'Zoom y espaciado')}
      {item('dotted', 1.75, 'Teclado')}
      {item('dashed', 1.75, 'Visión')}
      <span className="inline-flex items-center gap-2">
        <RouteSwatch />
        Orden del tabulador
      </span>
    </p>
  );
}

/** Mientras carga la página auditada, la captura aún no existe: un hueco con la forma que tendrá. */
function CaptureWaiting({ url }: { url: string }) {
  return (
    <div className="grid h-full min-h-72 place-items-center p-8">
      <div className="grid w-full max-w-sm justify-items-center gap-4 text-center">
        <span aria-hidden="true" className="lens-iris size-12 rounded-full [animation:breathe_2.4s_ease-in-out_infinite]" />
        <p className="text-text">La captura llegará en cuanto cargue la página.</p>
        <p className="max-w-full truncate font-mono text-xs text-text-muted">{url}</p>
        <span aria-hidden="true" className="mt-2 grid w-full gap-2">
          <span className="h-3 w-3/4 rounded-full bg-white/5" />
          <span className="h-3 w-full rounded-full bg-white/5" />
          <span className="h-3 w-2/3 rounded-full bg-white/5" />
        </span>
      </div>
    </div>
  );
}

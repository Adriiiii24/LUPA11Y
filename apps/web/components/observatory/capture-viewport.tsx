'use client';

/**
 * La captura auditada, vista a través de la lente: cada hallazgo es una caja redondeada (el estilo
 * de línea dice la fase), la ruta del tabulador es una curva Bézier continua que fluye entre paradas
 * que brillan, y la lupa óptica va encima.
 *
 * Todo lo que se pinta sobre la captura es `aria-hidden`: la misma información está en texto en el
 * panel del informe, que es el camino accesible por teclado.
 */
import type { KeyboardMap, Report } from '@lupa11y/core/schema';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState, type CSSProperties, type RefObject } from 'react';
import { OpticalLens } from '../optical-lens';
import { CAPTURE_GLOW, CAPTURE_INK, CAPTURE_MARK, CAPTURE_MARK_FILL, CAPTURE_ROUTE, CAPTURE_STITCH, lineWidth, SOURCE_LINE, stopTarget, type Target } from './model';

interface CaptureViewportProps {
  report: Report;
  targets: Target[];
  activeKey: string | null;
  selectedKey: string | null;
  showPath: boolean;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
}

const pct = (value: number, total: number) => `${(value / total) * 100}%`;
const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

export function CaptureViewport({ report, targets, activeKey, selectedKey, showPath, onSelect, onHover, scrollRef }: CaptureViewportProps) {
  const shot = report.screenshot;
  const reduced = useReducedMotion() ?? false;
  const [displayWidth, setDisplayWidth] = useState(0);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setDisplayWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollRef]);

  const stops = useMemo(
    () => (report.keyboard?.stops ?? []).filter((s) => s.rect && shot && s.rect.y + s.rect.height <= shot.height),
    [report.keyboard, shot],
  );
  const everything = useMemo(() => [...targets, ...stops.map(stopTarget).filter((t): t is Target => t !== null)], [targets, stops]);
  const active = everything.find((t) => t.key === activeKey) ?? null;
  const selected = everything.find((t) => t.key === selectedKey) ?? null;
  const scale = shot && displayWidth > 0 ? displayWidth / shot.width : 0;
  // Con la captura muy reducida (móvil) los números se solapan: las paradas pasan a puntos y el panel las numera.
  const compact = scale > 0 && scale < 0.5;

  // Al seleccionar desde el panel, la captura se desplaza hasta el nodo.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || !selected || scale === 0) return;
    const top = (selected.rect.y + selected.rect.height / 2) * scale - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
  }, [selected, scale, reduced, scrollRef]);

  if (!shot) return <p className="grid h-full place-items-center p-6 text-text-muted">Esta auditoría no incluye captura.</p>;

  return (
    <div
      className="relative aspect-(--capture-ratio) max-h-[62vh] lg:aspect-auto lg:h-full lg:max-h-none"
      style={{ '--capture-ratio': `${shot.width} / ${shot.height}` } as CSSProperties}
    >
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label={`Captura de «${report.title || report.finalUrl}», ${shot.width} por ${shot.height} píxeles, con los hallazgos marcados. El detalle de cada uno está en el panel del informe.`}
        className="peer focus-quiet relative h-full overflow-y-auto overflow-x-hidden overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,#000_1.25rem)]"
      >
        <OpticalLens
          src={shot.image}
          naturalSize={{ width: shot.width, height: shot.height }}
          focusPoint={selected ? { x: selected.rect.x + selected.rect.width / 2, y: selected.rect.y + selected.rect.height / 2 } : null}
          highlight={active ? { ...active.rect, color: CAPTURE_MARK } : null}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- captura producida por el motor, sin optimización posible */}
          <img src={shot.image} alt="" width={shot.width} height={shot.height} loading="lazy" decoding="async" draggable={false} className="block h-auto w-full" />
          <div aria-hidden="true" className="absolute inset-0">
            {targets.map((target) => {
              const isActive = target.key === activeKey;
              return (
                <div
                  key={target.key}
                  data-box-key={target.key}
                  onClick={() => onSelect(target.key)}
                  onMouseEnter={() => onHover(target.key)}
                  onMouseLeave={() => onHover(null)}
                  className="absolute cursor-crosshair rounded-[8px] transition-[background-color,box-shadow,opacity] duration-200"
                  style={{
                    left: pct(target.rect.x, shot.width),
                    top: pct(target.rect.y, shot.height),
                    width: pct(target.rect.width, shot.width),
                    height: pct(target.rect.height, shot.height),
                    outline: `${lineWidth(target.source, isActive)}px ${SOURCE_LINE[target.source]} ${CAPTURE_MARK}`,
                    outlineOffset: '2px',
                    boxShadow: isActive ? `0 0 0 2px #ffffff, 0 0 26px 6px ${CAPTURE_STITCH}99` : '0 0 0 2px rgb(255 255 255 / 0.8)',
                    background: isActive ? CAPTURE_MARK_FILL : 'transparent',
                    opacity: isActive || activeKey === null ? 1 : 0.6,
                  }}
                />
              );
            })}
            {showPath && report.keyboard && scale > 0 ? (
              <KeyboardPath keyboard={report.keyboard} stops={stops} width={shot.width} height={shot.height} scale={scale} reduced={reduced} />
            ) : null}
            {showPath
              ? stops.map((stop, i) => {
                  const rect = stop.rect!;
                  const inLoop = report.keyboard?.loop.includes(stop.index) ?? false;
                  const isActive = activeKey === `stop:${stop.index}`;
                  return (
                    <motion.span
                      key={stop.index}
                      data-box-key={`stop:${stop.index}`}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={reduced ? { duration: 0 } : { ...SPRING, delay: 0.3 + (i / Math.max(1, stops.length)) * 1.6 }}
                      className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-mono font-semibold tabular-nums ${
                        compact ? 'size-3' : 'size-6 text-[0.625rem]'
                      }`}
                      style={{
                        left: pct(rect.x + rect.width / 2, shot.width),
                        top: pct(rect.y + rect.height / 2, shot.height),
                        background: inLoop ? CAPTURE_ROUTE : '#ffffff',
                        color: inLoop ? '#ffffff' : CAPTURE_INK,
                        boxShadow: `0 0 0 2px ${CAPTURE_ROUTE}, 0 0 0 ${isActive ? 6 : 4}px rgb(var(--iris-rgb) / ${isActive ? 0.6 : 0.3}), 0 0 ${isActive ? 22 : 14}px ${CAPTURE_GLOW}`,
                      }}
                    >
                      {compact ? null : stop.index}
                    </motion.span>
                  );
                })
              : null}
            {active ? <Placard target={active} width={shot.width} height={shot.height} /> : null}
          </div>
        </OpticalLens>
      </div>
      <span aria-hidden="true" className="focus-ring" />
    </div>
  );
}

/** Curva Catmull-Rom que pasa por todas las paradas, convertida en tramos Bézier cúbicos. */
function curveThrough(points: ReadonlyArray<readonly [number, number]>): string {
  const [first] = points;
  if (!first) return '';
  let d = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * El orden del tabulador: un halo blanco para leerse sobre cualquier página, un resplandor iris, la
 * curva verde que se dibuja al entrar y un trazo discontinuo que fluye en el sentido del tabulador.
 * Si hay trampa, el tramo que cierra el bucle vuelve sobre sí mismo.
 */
function KeyboardPath({
  keyboard,
  stops,
  width,
  height,
  scale,
  reduced,
}: {
  keyboard: KeyboardMap;
  stops: KeyboardMap['stops'];
  width: number;
  height: number;
  scale: number;
  reduced: boolean;
}) {
  const center = (stop: KeyboardMap['stops'][number]) => [stop.rect!.x + stop.rect!.width / 2, stop.rect!.y + stop.rect!.height / 2] as const;
  const points = stops.map(center);
  if (points.length < 2) return null;
  const d = curveThrough(points);
  const loopStops = stops.filter((s) => keyboard.loop.includes(s.index));
  const loopBack =
    keyboard.outcome === 'trap' && loopStops.length > 1
      ? (() => {
          const [lx, ly] = center(loopStops.at(-1)!);
          const [fx, fy] = center(loopStops[0]!);
          const bend = 46 / scale;
          return `M${lx} ${ly} C${lx} ${ly - bend * 2}, ${fx} ${fy - bend * 2}, ${fx} ${fy}`;
        })()
      : null;
  const px = (n: number) => n / scale;
  const draw = { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: reduced ? { duration: 0 } : { duration: 2, ease: [0.16, 1, 0.3, 1] as const, delay: 0.2 } } as const;

  return (
    <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <motion.path d={d} fill="none" stroke="rgb(255 255 255 / 0.85)" strokeWidth={px(7)} strokeLinejoin="round" strokeLinecap="round" {...draw} />
      <motion.path d={d} fill="none" stroke={CAPTURE_GLOW} strokeOpacity={0.45} strokeWidth={px(10)} strokeLinecap="round" style={{ filter: 'blur(3px)' }} {...draw} />
      <motion.path d={d} fill="none" stroke={CAPTURE_ROUTE} strokeWidth={px(2.75)} strokeLinejoin="round" strokeLinecap="round" {...draw} />
      {/* El flujo: puntos blancos que avanzan por la curva. */}
      <path
        d={d}
        fill="none"
        stroke="#ffffff"
        strokeWidth={px(1.5)}
        strokeLinecap="round"
        strokeDasharray={`${px(0.1)} ${px(14)}`}
        className="[animation:dash-flow_1.6s_linear_infinite]"
        style={{ '--flow': `${-px(14.1)}` } as CSSProperties}
      />
      {loopBack ? (
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={reduced ? { duration: 0 } : { delay: 2.2, duration: 0.4 }}>
          <path d={loopBack} fill="none" stroke="rgb(255 255 255 / 0.85)" strokeWidth={px(7)} strokeLinecap="round" />
          <path d={loopBack} fill="none" stroke={CAPTURE_ROUTE} strokeWidth={px(2.75)} strokeLinecap="round" strokeDasharray={`${px(6)} ${px(5)}`} />
        </motion.g>
      ) : null}
    </svg>
  );
}

/** Rótulo del nodo activo: una píldora oscura que se lee sobre cualquier página. */
function Placard({ target, width, height }: { target: Target; width: number; height: number }) {
  const { rect } = target;
  const below = rect.y < 72;
  const alignRight = rect.x + rect.width / 2 > width * 0.62;
  const selector = target.selector.length > 56 ? `…${target.selector.slice(-55)}` : target.selector;
  return (
    <div
      className="pointer-events-none absolute z-40 w-max max-w-[min(24rem,90%)] rounded-[1.25rem] px-4 py-2.5 text-text"
      style={{
        background: 'rgb(var(--bg-rgb) / 0.94)',
        boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.12), 0 18px 40px -16px rgb(0 0 0 / 0.8)',
        top: below ? `calc(${pct(rect.y + rect.height, height)} + 12px)` : `calc(${pct(rect.y, height)} - 12px)`,
        transform: below ? undefined : 'translateY(-100%)',
        ...(alignRight ? { right: pct(width - rect.x - rect.width, width) } : { left: pct(rect.x, width) }),
      }}
    >
      <p className="text-[0.8125rem] font-medium leading-5">{target.band}</p>
      <p className="font-mono text-[0.6875rem] leading-5">
        <span className="text-azure-strong">{selector}</span>
        {target.role ? <span className="ml-2 text-text-muted">{target.role}</span> : null}
        <span className="ml-2 text-text-muted">
          {Math.round(rect.width)} × {Math.round(rect.height)}
        </span>
      </p>
    </div>
  );
}

'use client';

/**
 * OpticalLens · lupa óptica reutilizable: una esfera de cristal que amplía lo que tiene debajo.
 *
 * Envuelve una imagen (y lo que se pinte encima) y muestra una lente circular que la amplía:
 * - con el ratón, la lente sigue al puntero con un muelle;
 * - con el teclado o por programa (`focusPoint`), se acopla a un punto de la imagen;
 * - al tocar, se coloca donde cae el dedo.
 *
 * La refracción es real: un `feDisplacementMap` con un mapa de desplazamiento radial, generado
 * una vez en un canvas, curva el borde como una lente convexa. Sin soporte de filtros,
 * la lente sigue ampliando sin distorsión.
 *
 * Accesibilidad: la lente es decorativa (`aria-hidden`). La información que amplía tiene que
 * estar también en texto en otra parte de la interfaz; así lo usa el inspector.
 */
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { PALETTE, tint } from './palette';

export interface LensPoint {
  x: number;
  y: number;
}

export interface OpticalLensProps {
  /** Imagen que se amplía, la misma que se ve debajo. */
  src: string;
  /** Tamaño natural de la imagen, en el sistema de coordenadas de `focusPoint` y `highlight`. */
  naturalSize: { width: number; height: number };
  /** Aumento respecto a lo que se ve en pantalla. */
  zoom?: number;
  diameter?: number;
  /** Punto donde se acopla la lente cuando el puntero no está encima (coordenadas naturales). */
  focusPoint?: LensPoint | null;
  /** Caja resaltada dentro de la lente (coordenadas naturales). */
  highlight?: { x: number; y: number; width: number; height: number; color: string } | null;
  children: ReactNode;
  className?: string;
}

const SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.6 } as const;

/**
 * Mapa de desplazamiento radial: cerca del borde se muestrea más hacia fuera, como el canto de una
 * lente convexa. Se genera una vez por diámetro y se cachea. Solo en el cliente.
 */
const refractionMaps = new Map<number, string>();
function refractionMap(diameter: number): string | null {
  if (typeof document === 'undefined') return null;
  const cached = refractionMaps.get(diameter);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(diameter, diameter);
  const center = diameter / 2;
  for (let y = 0; y < diameter; y += 1) {
    for (let x = 0; x < diameter; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const strength = Math.min(1, Math.hypot(dx, dy)) ** 4;
      const i = (y * diameter + x) * 4;
      image.data[i] = 128 + 127 * dx * strength;
      image.data[i + 1] = 128 + 127 * dy * strength;
      image.data[i + 2] = 128;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const url = canvas.toDataURL();
  refractionMaps.set(diameter, url);
  return url;
}

export function OpticalLens({
  src,
  naturalSize,
  zoom = 2,
  diameter = 188,
  focusPoint = null,
  highlight = null,
  children,
  className = '',
}: OpticalLensProps) {
  const filterId = `lens-${useId().replace(/:/g, '')}`;
  const surface = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion() ?? false;
  const [pointer, setPointer] = useState<LensPoint | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = surface.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = width > 0 ? width / naturalSize.width : 0;
  // Punto activo en coordenadas de pantalla (dentro de la superficie).
  const active = useMemo<LensPoint | null>(() => {
    if (pointer) return pointer;
    if (focusPoint && scale > 0) return { x: focusPoint.x * scale, y: focusPoint.y * scale };
    return null;
  }, [pointer, focusPoint, scale]);

  const place = useCallback((clientX: number, clientY: number) => {
    const box = surface.current?.getBoundingClientRect();
    if (!box) return;
    setPointer({ x: clientX - box.left, y: clientY - box.top });
  }, []);

  const magnified = scale * zoom;
  const radius = diameter / 2;

  return (
    <div
      ref={surface}
      className={`relative select-none ${className}`}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse') place(event.clientX, event.clientY);
      }}
      onPointerDown={(event) => {
        if (event.pointerType !== 'mouse') place(event.clientX, event.clientY);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setPointer(null);
      }}
    >
      {children}

      {active && scale > 0 ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 z-30"
          style={{ width: diameter, height: diameter }}
          initial={reduced ? false : { x: active.x - radius, y: active.y - radius, opacity: 0, scale: 0.86 }}
          animate={{ x: active.x - radius, y: active.y - radius, opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0 } : { x: SPRING, y: SPRING, opacity: { duration: 0.2 }, scale: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
        >
          <LensGlass
            src={src}
            filterId={filterId}
            diameter={diameter}
            magnified={magnified}
            natural={naturalSize}
            offset={{ x: radius - (active.x / scale) * magnified, y: radius - (active.y / scale) * magnified }}
            reduced={reduced}
            highlight={highlight}
          />
        </motion.div>
      ) : null}
    </div>
  );
}

/**
 * Interior de la lente: la imagen ampliada, la retícula y el cristal. La imagen se desplaza con el
 * mismo muelle que la lente, así que el punto bajo la retícula siempre es el que se señala.
 */
function LensGlass({
  src,
  filterId,
  diameter,
  magnified,
  natural,
  offset,
  reduced,
  highlight,
}: {
  src: string;
  filterId: string;
  diameter: number;
  magnified: number;
  natural: { width: number; height: number };
  offset: LensPoint;
  reduced: boolean;
  highlight: OpticalLensProps['highlight'];
}) {
  const radius = diameter / 2;
  const refraction = refractionMap(diameter);

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-full"
      style={{
        // Canto de cristal: un filo claro, un aro oscuro para leerse sobre páginas claras y un halo iris.
        boxShadow:
          '0 0 0 1px rgb(255 255 255 / 0.7), 0 0 0 5px rgb(var(--bg-rgb) / 0.82), 0 0 0 6px rgb(255 255 255 / 0.22), -14px 0 32px 2px rgb(var(--azure-rgb) / 0.35), 14px 0 32px 2px rgb(var(--iris-rgb) / 0.3), 0 28px 50px -18px rgb(0 0 0 / 0.75)',
      }}
    >
      {refraction ? (
        <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
          <filter id={filterId} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feImage href={refraction} x="0" y="0" width={diameter} height={diameter} result="map" preserveAspectRatio="none" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={diameter * 0.22} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      ) : null}
      <div className="absolute inset-0 bg-surface" style={refraction ? { filter: `url(#${filterId})` } : undefined}>
        <motion.div
          className="absolute left-0 top-0"
          style={{ width: natural.width * magnified, height: natural.height * magnified }}
          initial={false}
          animate={{ x: offset.x, y: offset.y }}
          transition={reduced ? { duration: 0 } : { x: SPRING, y: SPRING }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ampliación de una imagen ya cargada */}
          <img src={src} alt="" draggable={false} className="block h-full w-full max-w-none" />
          {highlight ? (
            <div
              className="absolute rounded-[6px]"
              style={{
                left: highlight.x * magnified,
                top: highlight.y * magnified,
                width: highlight.width * magnified,
                height: highlight.height * magnified,
                boxShadow: `0 0 0 1.5px ${highlight.color}`,
              }}
            />
          ) : null}
        </motion.div>
      </div>
      {/* Retícula: dos hilos finos con hueco central y un aro iris en el punto que se señala. */}
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${diameter} ${diameter}`} aria-hidden="true">
        <g stroke="rgb(255 255 255 / 0.55)" strokeWidth="1">
          <line x1={radius} y1={22} x2={radius} y2={radius - 16} />
          <line x1={radius} y1={radius + 16} x2={radius} y2={diameter - 22} />
          <line x1={22} y1={radius} x2={radius - 16} y2={radius} />
          <line x1={radius + 16} y1={radius} x2={diameter - 22} y2={radius} />
        </g>
        <circle cx={radius} cy={radius} r="9" fill="none" stroke={tint('bg', 0.6)} strokeWidth="4" />
        <circle cx={radius} cy={radius} r="9" fill="none" stroke={PALETTE.azureStrong} strokeWidth="1.5" />
      </svg>
      {/* Brillo especular y viñeteado del cristal. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(110% 80% at 28% 14%, rgb(255 255 255 / 0.26), transparent 38%), radial-gradient(100% 100% at 50% 50%, transparent 66%, rgb(var(--bg-rgb) / 0.32) 100%), radial-gradient(60% 40% at 70% 92%, rgb(var(--iris-rgb) / 0.18), transparent 70%)',
        }}
      />
    </div>
  );
}

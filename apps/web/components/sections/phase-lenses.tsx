'use client';

/**
 * Las tres fases como lentes superpuestas que funcionan como pestañas (patrón APG: flechas, Inicio
 * y Fin). El diámetro sale de la raíz de la duración real, para que el área diga el tiempo; una
 * fase omitida queda como una lente vacía de trazo punteado. La prueba de la elegida aparece al lado.
 */
import type { Fix } from '@lupa11y/core/schema';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { DiffView } from '../diff-view';

type Evidence =
  | { kind: 'diff'; fix: Fix }
  | { kind: 'focus'; unfocused: string; focused: string; name: string; required: number | null; trap: number | null }
  | { kind: 'note'; text: string };

export interface PhaseLens {
  id: 'axe' | 'keyboard' | 'vision';
  name: string;
  duration: string;
  weight: number;
  title: string;
  body: string;
  footnote?: string;
  evidence: Evidence | null;
}

/** Dónde se colocan las lentes (centro, en % del lado) para que se crucen sin taparse los rótulos. */
const PLACE: Record<PhaseLens['id'], { x: number; y: number }> = {
  keyboard: { x: 39, y: 52 },
  axe: { x: 75, y: 29 },
  vision: { x: 73, y: 76 },
};
const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

/** El tinte de cada lente: la regla en azul, el agente en verde y el modelo entre los dos, como en el logo. */
const TINT: Record<PhaseLens['id'], { glow: string; deep: string }> = {
  axe: { glow: '86 194 242', deep: '40 120 170' },
  keyboard: { glow: '107 227 90', deep: '47 138 60' },
  vision: { glow: '78 210 180', deep: '31 143 122' },
};

export function PhaseLenses({ lenses, summary }: { lenses: PhaseLens[]; summary: string }) {
  const base = useId();
  const [selected, setSelected] = useState<PhaseLens['id']>(lenses[0]?.id ?? 'keyboard');
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const largest = Math.max(1, ...lenses.map((l) => l.weight));
  const current = lenses.find((l) => l.id === selected) ?? lenses[0];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = lenses.findIndex((l) => l.id === selected);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: lenses.length - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = lenses[(target + lenses.length) % lenses.length];
    if (!next) return;
    setSelected(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className="mt-14 grid items-center gap-10 lg:mt-20 lg:grid-cols-12 lg:gap-14">
      <div className="lg:col-span-5">
        <div role="tablist" aria-label="Fases de la auditoría" aria-orientation="horizontal" onKeyDown={onKeyDown} className="relative mx-auto aspect-square w-full max-w-[30rem]">
          {lenses.map((lens) => {
            const active = lens.id === selected;
            const skipped = lens.weight === 0;
            const size = skipped ? 30 : Math.max(30, 64 * Math.sqrt(lens.weight / largest));
            const { x, y } = PLACE[lens.id];
            return (
              <button
                key={lens.id}
                ref={(node) => {
                  if (node) refs.current.set(lens.id, node);
                  else refs.current.delete(lens.id);
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${lens.id}`}
                aria-selected={active}
                aria-controls={`${base}-panel`}
                tabIndex={active ? 0 : -1}
                onClick={() => setSelected(lens.id)}
                className={`absolute grid aspect-square -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-center transition-[box-shadow,transform,background-color] duration-500 ease-lens ${
                  active ? 'z-10 scale-100' : 'scale-[0.96] hover:scale-100'
                }`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}%`,
                  background: skipped
                    ? 'radial-gradient(circle at 34% 28%, rgb(255 255 255 / 0.06), transparent 40%), rgb(var(--surface-rgb) / 0.55)'
                    : active
                      ? `radial-gradient(circle at 34% 26%, rgb(255 255 255 / 0.16), transparent 34%), radial-gradient(circle at 50% 60%, rgb(${TINT[lens.id].glow} / 0.30), rgb(${TINT[lens.id].deep} / 0.12) 60%, rgb(var(--surface-rgb) / 0.6) 78%)`
                      : `radial-gradient(circle at 34% 26%, rgb(255 255 255 / 0.1), transparent 34%), radial-gradient(circle at 50% 60%, rgb(${TINT[lens.id].glow} / 0.16), rgb(var(--surface-rgb) / 0.55) 74%)`,
                  boxShadow: skipped
                    ? `inset 0 0 0 1.5px rgb(255 255 255 / ${active ? 0.5 : 0.22})`
                    : active
                      ? `inset 0 0 0 1.5px rgb(${TINT[lens.id].glow} / 0.75), 0 0 70px -10px rgb(${TINT[lens.id].glow} / 0.55)`
                      : 'inset 0 0 0 1px rgb(255 255 255 / 0.14)',
                }}
              >
                {skipped ? (
                  <span aria-hidden="true" className="absolute inset-[6%] rounded-full border border-dashed border-white/30" />
                ) : null}
                <span className="relative grid gap-1 px-3">
                  <span className={`text-[0.9375rem] font-medium leading-tight ${active ? 'text-text' : 'text-text-muted'}`}>{lens.name}</span>
                  <span className="font-mono text-sm text-text-muted">{lens.duration}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-text-muted">{summary}</p>
      </div>

      <div className="lg:col-span-7">
        <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${selected}`} tabIndex={0} className="shine-strong min-h-[26rem] rounded-[2.5rem] bg-raised p-6 sm:p-10">
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={SPRING}
              >
                <h3 className="text-[clamp(1.5rem,1.2rem+1vw,2rem)] font-semibold leading-tight tracking-[-0.03em] text-text">{current.title}</h3>
                <p className="mt-4 max-w-[58ch] text-lg leading-relaxed text-text-muted">{current.body}</p>
                {current.footnote ? <p className="mt-3 text-sm text-text-muted">{current.footnote}</p> : null}
                {current.evidence ? (
                  <div className="mt-8">
                    <EvidenceView evidence={current.evidence} id={current.id} />
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function EvidenceView({ evidence, id }: { evidence: Evidence; id: string }) {
  if (evidence.kind === 'diff') return <DiffView fix={evidence.fix} id={`phase-${id}`} />;
  if (evidence.kind === 'note') return <p className="rounded-[1.75rem] bg-surface px-6 py-5 text-text shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">{evidence.text}</p>;
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
        {(
          [
            ['Sin foco', evidence.unfocused],
            ['Con foco, tras pulsar Tab', evidence.focused],
          ] as const
        ).map(([label, src], i) => (
          <figure key={label} className={i === 1 ? 'col-start-3' : ''}>
            {/* eslint-disable-next-line @next/next/no-img-element -- recorte en data URL generado por el motor */}
            <img
              src={src}
              alt={`El enlace «${evidence.name}» del menú de la demo, ${label.toLowerCase()}.`}
              className="aspect-[4/3] w-full rounded-[1.5rem] bg-[#fbf6ef] object-contain [image-rendering:pixelated]"
            />
            <figcaption className="mt-2 text-center text-sm text-text-muted">{label}</figcaption>
          </figure>
        ))}
        {/* Lo que el motor midió entre las dos imágenes. */}
        <p className="col-start-2 row-start-1 grid size-24 place-items-center rounded-full bg-surface text-center shadow-[inset_0_0_0_1px_rgb(var(--azure-rgb)/0.4),-12px_0_40px_-12px_rgb(var(--azure-rgb)/0.5),12px_0_40px_-12px_rgb(var(--iris-rgb)/0.5)] sm:size-28">
          <span>
            <span className="block font-mono text-2xl text-iris-strong">0&nbsp;px²</span>
            <span className="block text-xs text-text-muted">de indicador</span>
          </span>
        </p>
      </div>
      <p className="mt-6 text-text">
        Resultado en la demo: 0 píxeles de indicador en los cuatro enlaces del menú
        {evidence.required ? ` (el primero necesitaba ${evidence.required} px²)` : ''}
        {evidence.trap ? `, y una trampa de teclado entre ${evidence.trap} elementos de la franja promocional` : ''}.
      </p>
    </div>
  );
}

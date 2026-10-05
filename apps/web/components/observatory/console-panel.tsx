'use client';

import { PHASE_LABEL } from '@lupa11y/core/format';
import type { PhaseId, Report } from '@lupa11y/core/schema';
import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/lib/use-audit-stream';
import { IconCheck, IconFail, IconSkip } from '../icons';

type State = 'running' | 'done' | 'skipped' | 'failed' | 'log' | 'error';

interface Line {
  id: string;
  ms: number;
  phase: PhaseId | null;
  state: State;
  message: string;
}

const clock = (ms: number) => {
  const total = Math.max(0, ms) / 1000;
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${(total - minutes * 60).toFixed(2).padStart(5, '0')}`;
};

/** Para la muestra: las notas de cada fase del informe, con su tiempo acumulado real. */
export function linesFromReport(report: Report): Line[] {
  let elapsed = 0;
  return report.phases.map((phase) => {
    elapsed += phase.durationMs;
    return { id: phase.id, ms: elapsed, phase: phase.id, state: phase.status, message: phase.note ?? '' };
  });
}

export function linesFromLog(log: readonly LogEntry[], startedAt: number): Line[] {
  return log.map(({ id, at, event }) => ({
    id: String(id),
    ms: at - startedAt,
    phase: event.type === 'error' ? null : event.phase,
    state: event.type === 'phase' ? event.state : event.type === 'error' ? 'error' : 'log',
    message: event.message,
  }));
}

function StateMark({ state }: { state: State }) {
  if (state === 'running')
    return <span aria-hidden="true" className="mt-[7px] block size-2 rounded-full bg-iris-strong [animation:pulse-dot_1.2s_ease-in-out_infinite]" />;
  if (state === 'done') return <IconCheck size={16} className="mt-0.5 text-iris" />;
  if (state === 'skipped') return <IconSkip size={16} className="mt-0.5 text-text-muted" />;
  if (state === 'failed' || state === 'error') return <IconFail size={16} className="mt-0.5 text-text" />;
  return <span aria-hidden="true" className="mt-[10px] block size-1 rounded-full bg-white/30" />;
}

const STATE_TEXT: Record<State, string> = { running: 'en curso', done: 'hecha', skipped: 'omitida', failed: 'fallida', log: '', error: 'error' };

/** El contenedor con desplazamiento propio más cercano; nunca la página. */
function ownScroller(element: HTMLElement | null): HTMLElement | null {
  for (let node = element?.parentElement ?? null; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/** Distancia (px) al final por debajo de la cual se sigue el registro automáticamente. */
const STICK = 48;

export type ConsoleLine = Line;

export function ConsolePanel({ lines, live }: { lines: Line[]; live: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  const following = useRef(true);

  // Quien sube a leer una línea anterior deja de seguir el registro hasta que vuelve abajo.
  useEffect(() => {
    const scroller = ownScroller(list.current);
    if (!scroller) return;
    const onScroll = () => {
      following.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK;
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [live]);

  // Solo se desplaza el panel. En pantallas estrechas el registro no tiene scroll propio y la
  // página no se mueve: mover la ventana sacaría a quien mira la lente del primer pantallazo.
  useEffect(() => {
    if (!live || !following.current) return;
    const scroller = ownScroller(list.current);
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [lines.length, live]);

  return (
    // La región viva es el aviso de fases del observatorio: aquí el registro no se anuncia línea a línea.
    <ol ref={list} role="log" aria-live="off" aria-label="Registro de la auditoría" className="space-y-1 p-6 font-mono text-[0.8125rem] leading-6">
      {lines.map((line) => (
        <li key={line.id} className="grid grid-cols-[4.75rem_1rem_minmax(0,1fr)] gap-x-2">
          <span className="tabular-nums text-text-muted">{clock(line.ms)}</span>
          <StateMark state={line.state} />
          <span className={line.state === 'log' ? 'text-text-muted' : 'text-text'}>
            {line.phase && line.state !== 'log' ? <span className="font-medium">{PHASE_LABEL[line.phase]}. </span> : null}
            {STATE_TEXT[line.state] ? <span className="visually-hidden">({STATE_TEXT[line.state]}) </span> : null}
            {line.message}
          </span>
        </li>
      ))}
      {live ? (
        <li className="grid grid-cols-[4.75rem_1rem_minmax(0,1fr)] gap-x-2" aria-hidden="true">
          <span />
          <span />
          <span className="h-5 w-2 rounded-full bg-iris [animation:caret-blink_1s_steps(1)_infinite]" />
        </li>
      ) : null}
    </ol>
  );
}

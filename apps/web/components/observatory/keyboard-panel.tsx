'use client';

import { OUTCOME_LABEL } from '@lupa11y/core/format';
import type { KeyboardMap, TabStop } from '@lupa11y/core/schema';
import { IconCheck, IconFail, IconSkip, IconWarning } from '../icons';
import { FOCUS_STATUS_LABEL, stopKey } from './model';

const STATUS_ICON = { visible: IconCheck, weak: IconWarning, invisible: IconFail, unmeasured: IconSkip } as const;

interface KeyboardPanelProps {
  keyboard: KeyboardMap | null;
  activeKey: string | null;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}

/** Las paradas del tabulador en orden, con la misma lente numerada que en la captura. */
export function KeyboardPanel({ keyboard, activeKey, onSelect, onHover }: KeyboardPanelProps) {
  if (!keyboard) return <p className="p-6 text-text-muted">El agente de teclado no se ejecutó en esta auditoría.</p>;
  const count = (status: TabStop['focus']['status']) => keyboard.stops.filter((s) => s.focus.status === status).length;

  return (
    <div className="p-2">
      <div className="px-4 pb-3 pt-2">
        <p className="text-text">
          {keyboard.stops.length} paradas con Tab. Cierre: <strong className="font-medium">{OUTCOME_LABEL[keyboard.outcome]}</strong>.
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-text-muted">
          <span>{count('visible')} con foco visible</span>
          <span>{count('weak')} débiles</span>
          <span className="text-text">{count('invisible')} invisibles</span>
        </p>
      </div>
      <ol aria-label="Paradas de foco en orden de tabulación" className="grid gap-1">
        {keyboard.stops.map((stop) => {
          const key = stopKey(stop);
          const inLoop = keyboard.loop.includes(stop.index);
          const Icon = STATUS_ICON[stop.focus.status];
          return (
            <li key={key} data-item-key={stop.rect ? key : undefined}>
              <button
                type="button"
                aria-pressed={activeKey === key}
                disabled={!stop.rect}
                onClick={() => onSelect(key)}
                onMouseEnter={() => onHover(key)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(key)}
                onBlur={() => onHover(null)}
                className="grid min-h-12 w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-full px-3 py-2 text-left transition-colors hover:bg-white/4 aria-pressed:bg-surface-2 aria-pressed:shadow-[inset_0_0_0_1px_rgb(var(--iris-rgb)/0.35)] disabled:cursor-default"
              >
                <span
                  className={`grid size-8 place-items-center rounded-full font-mono text-[0.75rem] tabular-nums ${inLoop ? 'bg-iris text-on-cta' : 'bg-surface text-text'}`}
                  style={{ boxShadow: inLoop ? '0 0 16px -4px var(--iris)' : 'inset 0 0 0 1.5px rgb(var(--iris-rgb) / 0.6)' }}
                >
                  {stop.index}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem] text-text">{stop.name || <em className="text-text-muted">sin nombre accesible</em>}</span>
                  <span className="block truncate font-mono text-[0.75rem] text-text-muted">
                    {stop.role} <span className="ml-1">{stop.selector}</span>
                  </span>
                </span>
                <span className="pr-2 text-right text-sm text-text">
                  <span className={`inline-flex items-center gap-1.5 ${stop.focus.status === 'invisible' ? 'font-medium' : 'text-text-muted'}`}>
                    <Icon size={15} />
                    {FOCUS_STATUS_LABEL[stop.focus.status]}
                  </span>
                  {stop.obscured === 'full' ? <span className="block font-medium">Tapado</span> : null}
                  {inLoop ? <span className="block font-medium">En el bucle</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

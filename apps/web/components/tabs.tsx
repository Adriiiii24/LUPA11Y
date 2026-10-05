'use client';

/**
 * Pestañas del patrón ARIA APG con activación automática: flechas, Inicio y Fin mueven y activan.
 * Se dibujan como un control segmentado en píldora; la activa lleva una lente que se desliza
 * entre pestañas con un muelle (layoutId).
 */
import { motion } from 'motion/react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  listClassName?: string;
  panelClassName?: string;
  /** Clases del envoltorio de cada panel (el que lleva el anillo de foco). */
  frameClassName?: string;
}

const SPRING = { type: 'spring', stiffness: 260, damping: 30 } as const;

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className = '',
  listClassName = '',
  panelClassName = '',
  frameClassName = '',
}: TabsProps<T>) {
  const base = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = items[(target + items.length) % items.length];
    if (!next) return;
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        className={`shine inline-flex items-center gap-1 overflow-x-auto rounded-full bg-surface p-1 ${listClassName}`}
        onKeyDown={onKeyDown}
      >
        {items.map((item) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) refs.current.set(item.id, node);
                else refs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              className={`relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 text-[0.875rem] transition-colors duration-200 sm:px-4 sm:text-[0.9375rem] ${
                selected ? 'text-text' : 'text-text-muted hover:text-text'
              }`}
            >
              {selected ? (
                <motion.span layoutId={`${base}-lens`} transition={SPRING} aria-hidden="true" className="sphere absolute inset-0 rounded-full" />
              ) : null}
              <span className="relative inline-flex items-center gap-2">{item.label}</span>
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div key={item.id} hidden={item.id !== value} className={`relative ${frameClassName}`}>
          <div
            role="tabpanel"
            id={`${base}-panel-${item.id}`}
            aria-labelledby={`${base}-tab-${item.id}`}
            hidden={item.id !== value}
            tabIndex={0}
            className={`peer focus-quiet ${panelClassName}`}
          >
            {item.id === value ? item.content : null}
          </div>
          <span aria-hidden="true" className="focus-ring" />
        </div>
      ))}
    </div>
  );
}

'use client';

import type { Fix } from '@lupa11y/core/schema';
import { useCopy } from '@/lib/use-copy';
import { IconCheck, IconCopy } from './icons';

/** Lo que sale se atenúa y se tacha; lo que entra se ilumina con el iris. El signo lo dice también. */
const LINE_STYLE: Record<string, string> = {
  '+': 'bg-[rgb(var(--iris-rgb)/0.1)] text-text',
  '-': 'text-text-muted line-through decoration-white/30',
  ' ': 'text-text-muted',
};

const MARK_STYLE: Record<string, string> = {
  '+': 'text-iris',
  '-': 'text-text-muted',
  ' ': '',
};

/** Diff unificado legible, con copia del diff completo o solo del código corregido. */
export function DiffView({ fix, id }: { fix: Fix; id: string }) {
  const { copied, copy } = useCopy();
  const lines = fix.diff.split('\n');
  const file = lines[1]?.replace(/^\+\+\+ b\//, '') ?? '';
  const body = lines.slice(3);

  return (
    <figure className="shine min-w-0 overflow-hidden rounded-3xl bg-bg">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 py-1.5 pl-5 pr-1.5">
        <span className="text-sm text-text-muted">
          <span className="font-mono text-[0.8125rem] text-text">{file}</span>, {fix.origin === 'deterministic' ? 'arreglo calculado' : 'propuesto por el modelo'}
        </span>
        <span className="flex">
          <CopyButton label="Copiar diff" done={copied === `${id}:diff`} onClick={() => copy(`${id}:diff`, fix.diff)} />
          <CopyButton label="Copiar código" done={copied === `${id}:after`} onClick={() => copy(`${id}:after`, fix.after)} />
        </span>
      </figcaption>
      <pre tabIndex={0} role="region" aria-label={`Diff de ${file}`} className="focus-inset overflow-x-auto rounded-[1.25rem] px-2 pb-3 text-[0.8125rem] leading-6">
        <code>
          {body.map((line, index) => {
            const mark = line[0] === '+' || line[0] === '-' ? line[0] : ' ';
            return (
              <span key={index} className={`flex min-w-max rounded-full pr-4 ${LINE_STYLE[mark]}`}>
                <span aria-hidden="true" className={`w-8 shrink-0 select-none text-center ${MARK_STYLE[mark]}`}>
                  {mark === ' ' ? '' : mark}
                </span>
                <span className="visually-hidden">{mark === '+' ? 'añadido: ' : mark === '-' ? 'eliminado: ' : ''}</span>
                <span className="whitespace-pre">{line.slice(1) || ' '}</span>
              </span>
            );
          })}
        </code>
      </pre>
      <span className="visually-hidden" aria-live="polite">
        {copied?.startsWith(id) ? 'Copiado al portapapeles.' : ''}
      </span>
    </figure>
  );
}

function CopyButton({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm text-text-muted transition-colors hover:bg-white/6 hover:text-text active:scale-[0.98]"
    >
      {done ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {done ? 'Copiado' : label}
    </button>
  );
}

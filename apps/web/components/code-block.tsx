'use client';

import { useId } from 'react';
import { useCopy } from '@/lib/use-copy';
import { IconCheck, IconCopy } from './icons';

/** Bloque de código con nombre de fichero y copia al portapapeles. Sin resaltado: el código se lee solo. */
export function CodeBlock({ code, file, language }: { code: string; file: string; language: string }) {
  const id = useId();
  const { copied, copy } = useCopy();
  const done = copied === id;
  return (
    <figure className="shine min-w-0 overflow-hidden rounded-[1.75rem] bg-bg">
      <figcaption className="flex items-center justify-between gap-3 py-2 pl-5 pr-2">
        <span className="flex min-w-0 items-center gap-2.5 font-mono text-[0.8125rem] text-text-muted">
          <span className="truncate">{file}</span> <span className="visually-hidden">({language})</span>
        </span>
        <button
          type="button"
          onClick={() => copy(id, code)}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm text-text-muted transition-colors hover:bg-white/6 hover:text-text active:scale-[0.98]"
        >
          {done ? <IconCheck size={16} /> : <IconCopy size={16} />}
          {done ? 'Copiado' : 'Copiar'}
          <span className="visually-hidden"> {file}</span>
        </button>
      </figcaption>
      <pre tabIndex={0} role="region" aria-label={`Código: ${file}`} className="focus-inset overflow-x-auto rounded-[1.25rem] px-5 pb-5 pt-2 text-[0.8125rem] leading-6 text-text">
        <code>{code}</code>
      </pre>
      <span className="visually-hidden" aria-live="polite">
        {done ? 'Copiado al portapapeles.' : ''}
      </span>
    </figure>
  );
}

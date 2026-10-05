'use client';

/**
 * El iris: el campo de URL como una píldora flotante con una lente a la izquierda. Al enfocar, la
 * lente se abre un poco y la píldora se ilumina; al auditar, la lente sale volando hacia el
 * observatorio (layoutId) y en su sitio queda el hueco, hasta que vuelve otra nueva.
 *
 * Etiqueta visible encima, ayuda debajo y error en línea; el placeholder nunca hace de etiqueta.
 *
 * Mientras audita, Enter no hace nada: cancelar es un botón aparte, para que un Enter de más no
 * tire una auditoría a medias.
 */
import { motion } from 'motion/react';
import { useState, type FormEvent, type Ref } from 'react';
import { IconArrowRight, IconStop } from '../icons';
import { AlertTile } from '../logo';

const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

interface IrisInputProps {
  ref?: Ref<HTMLInputElement>;
  running: boolean;
  lensId: string;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}

export function IrisInput({ ref, running, lensId, onSubmit, onCancel }: IrisInputProps) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (running) return;
    const url = value.trim();
    if (!url) {
      setHint('Escribe la dirección de una página pública, por ejemplo https://www.tu-tienda.es.');
      return;
    }
    setHint(null);
    onSubmit(url);
  };

  return (
    <form onSubmit={submit} noValidate className="w-full max-w-[40rem]">
      <label htmlFor="audit-url" className="mb-3 block pl-6 text-sm font-medium text-text-muted">
        Dirección de la página
      </label>
      <div
        className={`group relative flex flex-wrap items-center gap-2 rounded-[2.25rem] p-2 transition-shadow duration-300 sm:flex-nowrap sm:rounded-full ${
          hint ? 'shadow-[0_0_0_2px_var(--iris-strong)]' : 'focus-within:shadow-[0_0_0_2px_var(--azure),-24px_0_60px_-16px_rgb(var(--azure-rgb)/0.5),24px_0_60px_-16px_rgb(var(--iris-rgb)/0.5)]'
        }`}
        style={{
          background: 'radial-gradient(140% 220% at 0% 0%, rgb(255 255 255 / 0.06), transparent 50%), var(--surface)',
        }}
      >
        <span aria-hidden="true" className="shine pointer-events-none absolute inset-0 rounded-[inherit]" />
        <span className="relative grid size-14 shrink-0 place-items-center">
          {running ? (
            <span aria-hidden="true" className="size-10 rounded-full bg-white/4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]" />
          ) : (
            <motion.span
              layoutId={lensId}
              transition={SPRING}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              aria-hidden="true"
              className="relative block size-14 rounded-full"
            >
              <span className="iris-ring relative block size-full rounded-full transition-transform duration-500 ease-lens group-focus-within:scale-110">
                <span className="absolute inset-[34%] rounded-full bg-(--pupil) transition-transform duration-500 ease-lens group-focus-within:scale-[1.55]" />
                <span className="absolute left-[26%] top-[20%] size-[18%] rounded-full bg-white/60" />
              </span>
              <span className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-[0_0_0_1.5px_rgb(var(--azure-rgb)/0.85),0_0_24px_rgb(var(--iris-rgb)/0.45)] transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-focus-within:scale-[1.55] group-focus-within:opacity-100" />
            </motion.span>
          )}
        </span>
        <input
          ref={ref}
          id="audit-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          autoCapitalize="off"
          placeholder="https://www.tu-tienda.es"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-describedby={hint ? 'audit-url-help audit-url-hint' : 'audit-url-help'}
          aria-invalid={hint ? true : undefined}
          readOnly={running}
          className="relative h-14 min-w-0 flex-1 bg-transparent pr-2 font-mono text-[1.0625rem] text-text outline-none placeholder:text-text-muted"
        />
        {/* Un solo botón que cambia de papel: si fueran dos, al pulsar «Auditar» el foco se perdería. */}
        <button
          type={running ? 'button' : 'submit'}
          onClick={running ? onCancel : undefined}
          className={`relative inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full px-7 font-medium transition-[background-color,transform] duration-200 active:scale-[0.98] sm:w-auto ${
            running ? 'bg-surface-2 text-text shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1)] hover:bg-white/10' : 'bg-lens text-on-cta shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] hover:bg-lens-hover'
          }`}
        >
          {running ? (
            <>
              <IconStop size={18} /> Cancelar
            </>
          ) : (
            <>
              Auditar una URL <IconArrowRight size={18} />
            </>
          )}
        </button>
      </div>
      <p id="audit-url-help" className="mt-3 pl-6 text-sm text-text-muted">
        Una página pública. Tarda unos diez segundos y no envía nada en tu nombre.
      </p>
      {hint ? (
        <p id="audit-url-hint" role="alert" className="mt-2 flex items-start gap-2 pl-6 text-sm font-medium text-text">
          <AlertTile size={18} className="mt-px" />
          {hint}
        </p>
      ) : null}
    </form>
  );
}

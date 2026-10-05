'use client';

import { motion } from 'motion/react';
import { useId, useState } from 'react';
import { IconCheck, IconSkip } from '../icons';
import { AlertTile } from '../logo';

type Sector = 'ecommerce' | 'banca' | 'transporte' | 'telecom' | 'ebooks' | 'otro';
type Size = 'micro' | 'mayor';

const SECTORS: Array<{ id: Sector; label: string }> = [
  { id: 'ecommerce', label: 'Comercio electrónico' },
  { id: 'banca', label: 'Banca para consumidores' },
  { id: 'transporte', label: 'Transporte de viajeros' },
  { id: 'telecom', label: 'Comunicaciones electrónicas' },
  { id: 'ebooks', label: 'Libros electrónicos' },
  { id: 'otro', label: 'Otro sector' },
];

function verdict(sector: Sector, size: Size): { tone: 'yes' | 'no' | 'maybe'; text: string } {
  if (sector === 'otro') {
    return {
      tone: 'maybe',
      text: 'Tu sector no está entre los servicios de la Ley 11/2023. Pero si vendes a consumidores a través de la web o de una app, eso es comercio electrónico y sí entra.',
    };
  }
  if (size === 'micro') {
    return {
      tone: 'no',
      text: 'Las microempresas que prestan servicios están exentas de estos requisitos. La exención no cubre a quien fabrica o comercializa productos.',
    };
  }
  return {
    tone: 'yes',
    text: 'Tu servicio digital debe cumplir la EN 301 549 (WCAG 2.1 AA) desde el 28/06/2025. Lo que ya usabas antes para prestarlo tiene margen hasta el 28/06/2030.',
  };
}

const HEADLINE = { yes: 'Te afecta', no: 'Probablemente exenta', maybe: 'Depende de cómo vendas' } as const;

/** Opción en píldora: marcada, se llena de luz; el foco del radio se ve en la propia píldora. */
const OPTION =
  'inline-flex min-h-12 cursor-pointer items-center rounded-full bg-surface-2 px-5 text-[0.9375rem] text-text-muted shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] transition-[background-color,color,box-shadow] duration-200 hover:text-text has-[:checked]:bg-lens has-[:checked]:font-medium has-[:checked]:text-on-cta has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-azure';

/** Comprobador orientativo: dos preguntas y una respuesta que cita la norma, sin asustar. */
export function EaaChecker() {
  const id = useId();
  const [sector, setSector] = useState<Sector>('ecommerce');
  const [size, setSize] = useState<Size>('mayor');
  const result = verdict(sector, size);

  return (
    <form className="shine-strong rounded-[2.5rem] bg-surface p-7 sm:p-9" onSubmit={(event) => event.preventDefault()} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-xl font-semibold tracking-[-0.02em] text-text">
        ¿Le afecta a tu empresa?
      </h3>
      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-text-muted">¿Qué servicio prestas?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {SECTORS.map((option) => (
            <label key={option.id} className={OPTION}>
              <input type="radio" name={`${id}-sector`} value={option.id} checked={sector === option.id} onChange={() => setSector(option.id)} className="visually-hidden" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-text-muted">¿Qué tamaño tiene?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ['mayor', '10 personas o más, o más de 2 M€'],
              ['micro', 'Microempresa: menos de 10 personas y hasta 2 M€'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={OPTION}>
              <input type="radio" name={`${id}-size`} value={value} checked={size === value} onChange={() => setSize(value)} className="visually-hidden" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <output aria-live="polite" className="mt-8 block rounded-4xl bg-bg/70 p-6 shadow-[inset_0_0_0_1px_rgb(var(--azure-rgb)/0.3)]">
        <motion.span
          key={result.tone}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="flex items-center gap-3 text-lg font-semibold text-text"
        >
          <ResultIcon tone={result.tone} />
          {HEADLINE[result.tone]}
        </motion.span>
        <span className="mt-2 block max-w-[60ch] leading-relaxed text-text-muted">{result.text}</span>
      </output>
    </form>
  );
}

function ResultIcon({ tone }: { tone: 'yes' | 'no' | 'maybe' }) {
  if (tone === 'yes') return <AlertTile size={26} />;
  const Icon = tone === 'no' ? IconCheck : IconSkip;
  return (
    <span className="grid size-6.5 place-items-center rounded-full bg-white/10">
      <Icon size={16} />
    </span>
  );
}

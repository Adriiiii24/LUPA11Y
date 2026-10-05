import Image from 'next/image';
import mark from './brand/lupa11y-mark.png';
import { PALETTE } from './palette';

/**
 * La marca: dos lentes que se funden en una lupa (imagen proporcionada por el autor). Es decorativa:
 * el nombre «LupA11y» va siempre al lado en texto.
 */
export function LogoMark({ size = 32, className = '', priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return <Image src={mark} alt="" width={size} height={size} priority={priority} className={`shrink-0 select-none ${className}`} draggable={false} />;
}

/** Aviso: una lente con la exclamación. Siempre va con su texto al lado. */
export function AlertTile({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="11" fill={PALETTE.irisStrong} />
      <path d="M12 6.4 V13.2" stroke={PALETTE.bg} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="1.5" fill={PALETTE.bg} />
    </svg>
  );
}

export function Logo({ className = '', priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark priority={priority} />
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">LupA11y</span>
    </span>
  );
}

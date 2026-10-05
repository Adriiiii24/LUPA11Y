import { SEVERITY_LABEL, SOURCE_LABEL } from '@lupa11y/core/format';
import type { Severity, Source } from '@lupa11y/core/schema';
import { IconCode, IconEye, IconKeyboard, IconZoom } from '../icons';
import { SEVERITY_SIZE, SEVERITY_TONE } from './model';

/**
 * Severidad como una pequeña lente (su tono y su tamaño crecen con la gravedad) más su nombre.
 * El nombre siempre está: el tono nunca es la única pista.
 */
export function SeverityTag({ severity, showLabel = true }: { severity: Severity; showLabel?: boolean }) {
  const tone = SEVERITY_TONE[severity];
  const size = 6 + SEVERITY_SIZE[severity] * 6;
  return (
    <span className={`inline-flex items-center gap-2 text-sm ${severity === 'critical' && showLabel ? 'rounded-full bg-white/8 py-0.5 pl-2 pr-2.5 text-text' : 'text-text'}`}>
      <span aria-hidden="true" className="grid size-3 shrink-0 place-items-center">
        <span className="rounded-full" style={{ width: size, height: size, background: tone, boxShadow: `0 0 10px ${tone}88` }} />
      </span>
      {showLabel ? <span>{SEVERITY_LABEL[severity]}</span> : <span className="visually-hidden">{SEVERITY_LABEL[severity]}</span>}
    </span>
  );
}

const SOURCE_ICON = { axe: IconCode, layout: IconZoom, keyboard: IconKeyboard, vision: IconEye } as const;

/** Fuente del hallazgo como pictograma y nombre. */
export function SourceMark({ source }: { source: Source }) {
  const Icon = SOURCE_ICON[source];
  return (
    <span className="inline-flex items-center gap-1.5 text-text-muted">
      <Icon size={15} />
      {SOURCE_LABEL[source]}
    </span>
  );
}

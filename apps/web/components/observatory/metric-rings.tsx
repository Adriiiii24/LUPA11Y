'use client';

/**
 * Tres anillos concéntricos con datos reales del informe. No hay «puntuación de accesibilidad»: el
 * producto no la mide y no se inventa.
 *
 * - Exterior (azul): fases ejecutadas (las omitidas van en puntos).
 * - Medio (azul): paradas del tabulador con foco visible y con foco débil, sobre el total.
 * - Interior (verde): hallazgos por severidad, en la rampa ordinal verde.
 *
 * El dibujo es decorativo (`aria-hidden`); la leyenda de debajo dice lo mismo en texto, y el núcleo
 * es el punto de llegada de la lente que audita (layoutId).
 */
import { PHASE_LABEL, SEVERITY_LABEL } from '@lupa11y/core/format';
import { SEVERITIES, type Report } from '@lupa11y/core/schema';
import { motion } from 'motion/react';
import { PALETTE } from '../palette';
import { SEVERITY_TONE } from './model';

const C = 200;
const STROKE = 16;
const RINGS = { phases: 182, focus: 152, severity: 122 } as const;
const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

interface Segment {
  key: string;
  from: number;
  to: number;
  color: string;
  dotted?: boolean | undefined;
}

/** Arco en grados, 0 arriba y en el sentido de las agujas del reloj. */
function arc(r: number, from: number, to: number): string {
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(C + r * Math.cos(rad)).toFixed(2)} ${(C + r * Math.sin(rad)).toFixed(2)}`;
  };
  const large = to - from > 180 ? 1 : 0;
  return `M${point(from)} A${r} ${r} 0 ${large} 1 ${point(to)}`;
}

/** Reparte 360° entre partes proporcionales, dejando el hueco de los extremos redondeados. */
function segments(r: number, parts: Array<{ key: string; value: number; color: string; dotted?: boolean | undefined }>, total: number): Segment[] {
  const gap = ((STROKE + 7) / (2 * Math.PI * r)) * 360;
  const out: Segment[] = [];
  let cursor = 0;
  for (const part of parts) {
    if (part.value <= 0 || total <= 0) continue;
    const sweep = (part.value / total) * 360;
    const from = cursor + gap / 2;
    const to = Math.max(from + 0.5, cursor + sweep - gap / 2);
    out.push({ key: part.key, from, to, color: part.color, dotted: part.dotted });
    cursor += sweep;
  }
  return out;
}

export function ringData(report: Report) {
  const phases = report.phases;
  const done = phases.filter((p) => p.status === 'done').length;
  const skipped = phases.filter((p) => p.status === 'skipped');
  const stops = report.keyboard?.stops ?? [];
  const focus = {
    visible: stops.filter((s) => s.focus.status === 'visible').length,
    weak: stops.filter((s) => s.focus.status === 'weak').length,
    invisible: stops.filter((s) => s.focus.status === 'invisible').length,
    total: stops.length,
  };
  return { phases, done, skipped, focus, severity: report.summary.bySeverity, total: report.summary.total };
}

export function MetricRings({ report, coreLayoutId }: { report: Report; coreLayoutId?: string | undefined }) {
  const data = ringData(report);

  const phaseSegments = segments(
    RINGS.phases,
    data.phases.map((p) => ({
      key: p.id,
      value: 1,
      color: p.status === 'done' ? PALETTE.azure : p.status === 'failed' ? PALETTE.azureDeep : 'rgb(255 255 255 / 0.42)',
      dotted: p.status !== 'done',
    })),
    data.phases.length,
  );
  const focusSegments = segments(
    RINGS.focus,
    [
      { key: 'visible', value: data.focus.visible, color: PALETTE.azureStrong },
      { key: 'weak', value: data.focus.weak, color: PALETTE.azureDeep },
    ],
    data.focus.total,
  );
  const severitySegments = segments(
    RINGS.severity,
    SEVERITIES.map((s) => ({ key: s, value: data.severity[s], color: SEVERITY_TONE[s] })),
    data.total,
  );

  const rings: Array<[keyof typeof RINGS, Segment[]]> = [
    ['phases', phaseSegments],
    ['focus', focusSegments],
    ['severity', severitySegments],
  ];

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox="0 0 400 400" aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
        {Object.values(RINGS).map((r) => (
          <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgb(255 255 255 / 0.05)" strokeWidth={STROKE} />
        ))}
        {rings.map(([ring, list], ringIndex) =>
          list.map((segment, i) => (
            <motion.path
              key={`${report.auditedAt}-${ring}-${segment.key}`}
              d={arc(RINGS[ring], segment.from, segment.to)}
              fill="none"
              stroke={segment.color}
              strokeWidth={segment.dotted ? STROKE * 0.42 : STROKE}
              strokeLinecap="round"
              strokeDasharray={segment.dotted ? '0.1 14' : undefined}
              style={{ filter: segment.dotted ? 'none' : `drop-shadow(0 0 10px ${segment.color}55)` }}
              // Los puntos de lo omitido no se «dibujan»: el trazo discontinuo y pathLength usan la misma propiedad.
              initial={segment.dotted ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
              animate={segment.dotted ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
              transition={{ ...SPRING, delay: 0.35 + ringIndex * 0.12 + i * 0.06 }}
            />
          )),
        )}
      </svg>

      {/* El núcleo: la pupila a la que llega la lente cuando termina la auditoría. */}
      <motion.div
        {...(coreLayoutId ? { layoutId: coreLayoutId } : {})}
        transition={SPRING}
        className="absolute inset-[28%] grid place-items-center rounded-full"
        style={{
          background:
            'radial-gradient(circle at 34% 26%, rgb(255 255 255 / 0.12), transparent 34%), radial-gradient(circle at 50% 50%, var(--pupil) 0 62%, var(--pupil-rim) 78%, var(--teal-shade) 94%)',
          boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.12), -18px 0 60px -14px rgb(var(--azure-rgb) / 0.35), 18px 0 60px -14px rgb(var(--iris-rgb) / 0.35)',
        }}
      >
        <motion.span className="grid place-items-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.25 }}>
          <span className="font-mono text-[clamp(2.25rem,1.6rem+2vw,3.25rem)] font-medium leading-none tracking-[-0.04em] text-text tabular-nums">{data.total}</span>
          <span className="mt-1.5 text-sm text-text-muted">hallazgos</span>
        </motion.span>
      </motion.div>
    </div>
  );
}

/** La leyenda: cada anillo en texto, con su muestra. Es el equivalente accesible del dibujo. */
export function RingLegend({ report }: { report: Report }) {
  const data = ringData(report);
  const severityText = SEVERITIES.filter((s) => data.severity[s] > 0)
    .map((s) => `${SEVERITY_LABEL[s].toLowerCase()} ${data.severity[s]}`)
    .join(', ');
  const items = [
    {
      term: 'Fases',
      value: `${data.done} de ${data.phases.length}`,
      detail: data.skipped.length ? `${data.skipped.map((p) => PHASE_LABEL[p.id]).join(' y ')}, omitida` : 'Todas completas',
      swatch: PALETTE.azure,
    },
    {
      term: 'Foco visible',
      value: `${data.focus.visible} de ${data.focus.total}`,
      detail: `${data.focus.weak} débiles, ${data.focus.invisible} invisibles`,
      swatch: PALETTE.azureStrong,
    },
    { term: 'Por severidad', value: String(data.total), detail: severityText ? `${severityText.charAt(0).toUpperCase()}${severityText.slice(1)}` : 'Sin hallazgos', swatch: PALETTE.sevMedium },
  ];
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-2 px-2">
      {items.map((item) => (
        <div key={item.term} className="min-w-0">
          <dt className="flex items-center gap-2 whitespace-nowrap text-sm text-text-muted">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ boxShadow: `0 0 0 2px ${item.swatch}` }} />
            {item.term}
          </dt>
          <dd className="mt-1.5">
            <span className="font-mono text-xl tracking-[-0.02em] text-text tabular-nums">{item.value}</span>
            <span className="mt-0.5 block text-sm leading-snug text-text-muted">{item.detail}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

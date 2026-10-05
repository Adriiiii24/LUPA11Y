'use client';

/**
 * El observatorio del primer pantallazo. Tiene tres estados y una sola pieza que viaja entre ellos:
 *
 * - En reposo, los anillos y las burbujas del informe que se está viendo (la muestra o el último).
 * - Al auditar, la lente del iris llega aquí (layoutId), se dilata y late; un anillo de cuatro
 *   tramos marca las fases reales según llegan del motor.
 * - Al terminar, esa misma lente se convierte en el núcleo de los anillos del nuevo informe.
 */
import { PHASE_LABEL } from '@lupa11y/core/format';
import { PHASES, type Finding, type Report } from '@lupa11y/core/schema';
import { motion } from 'motion/react';
import type { AuditState } from '@/lib/use-audit-stream';
import { IconArrowDown, IconExternal } from '../icons';
import { PALETTE } from '../palette';
import { AlertTile } from '../logo';
import { FindingBubbles } from './finding-bubbles';
import { MetricRings, RingLegend } from './metric-rings';

const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

interface AuditOrbProps {
  state: AuditState;
  report: Report;
  isSample: boolean;
  /** Identidad de la lente que viaja: la que llegó del iris en esta auditoría. */
  lensId: string;
  activeFindingId: string | null;
  onSelectFinding: (finding: Finding) => void;
  onRetry: () => void;
  onSample: () => void;
}

export function AuditOrb({ state, report, isSample, lensId, activeFindingId, onSelectFinding, onRetry, onSample }: AuditOrbProps) {
  if (state.status === 'running') return <RunningLens state={state} lensId={lensId} />;
  if (state.status === 'error' && state.error) return <ErrorLens message={state.error.message} onRetry={onRetry} onSample={onSample} />;

  return (
    <figure className="mx-auto w-full max-w-[34rem]">
      <div className="relative">
        <div className="relative mx-auto aspect-square w-full">
          <div className="absolute inset-[13%]">
            <MetricRings report={report} coreLayoutId={isSample ? undefined : lensId} />
          </div>
          <FindingBubbles report={report} activeId={activeFindingId} onSelect={onSelectFinding} />
        </div>
      </div>
      <div className="mt-2">
        <RingLegend report={report} />
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2 text-sm text-text-muted">
        {isSample ? (
          <span>
            Muestra: auditoría real de{' '}
            <a href="/demo" target="_blank" className="inline-flex items-center gap-1 text-text underline decoration-white/30 hover:decoration-azure">
              /demo
              <IconExternal size={13} />
              <span className="visually-hidden"> (se abre en otra pestaña)</span>
            </a>
            , una tienda inventada y rota a propósito.
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate font-mono text-text">{report.finalUrl}</span>
            <button type="button" onClick={onSample} className="min-h-11 shrink-0 rounded-full px-3 text-text underline decoration-white/30 hover:decoration-azure">
              Ver la muestra
            </button>
          </span>
        )}
        <a href="#informe" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-text no-underline transition-colors hover:bg-white/6">
          Ver el informe <IconArrowDown size={15} />
        </a>
      </figcaption>
    </figure>
  );
}

/** La lente dilatada que audita. El anillo de fuera son las fases reales del motor. */
function RunningLens({ state, lensId }: { state: AuditState; lensId: string }) {
  const stateOf = (phase: (typeof PHASES)[number]) => {
    const last = [...state.log].reverse().find((entry) => entry.event.type === 'phase' && entry.event.phase === phase);
    return last?.event.type === 'phase' ? last.event.state : 'pending';
  };
  const states = PHASES.map((phase) => ({ phase, state: stateOf(phase) }));
  const current = states.find((s) => s.state === 'running') ?? [...states].reverse().find((s) => s.state !== 'pending');
  const label: Record<string, string> = { pending: 'en cola', running: 'midiendo', done: 'cerrada', skipped: 'omitida', failed: 'fallida' };
  const lastMessage = [...state.log].reverse().find((entry) => entry.event.type !== 'error')?.event.message ?? 'Abriendo la página en Chromium.';

  return (
    <div className="mx-auto grid w-full max-w-[34rem] justify-items-center">
      <div className="relative aspect-square w-[min(100%,26rem)]">
        {/* Halo que respira detrás de la lente. */}
        <span
          aria-hidden="true"
          className="absolute inset-[-6%] rounded-full [animation:halo_2.4s_ease-in-out_infinite]"
          style={{ background: 'radial-gradient(circle at 40% 50%, rgb(var(--azure-rgb) / 0.24), transparent 62%), radial-gradient(circle at 60% 50%, rgb(var(--iris-rgb) / 0.24), transparent 62%)' }}
        />
        {/* Las fases: un tramo por fase alrededor de la lente. */}
        <svg viewBox="0 0 200 200" aria-hidden="true" className="absolute inset-0 h-full w-full -rotate-90 overflow-visible">
          {states.map(({ phase, state: s }, i) => {
            const r = 96;
            const length = 2 * Math.PI * r;
            const segment = length / states.length;
            const gap = 10;
            return (
              <circle
                key={phase}
                cx="100"
                cy="100"
                r={r}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                stroke={s === 'done' ? PALETTE.azure : s === 'running' ? PALETTE.azureStrong : s === 'failed' ? PALETTE.azureDeep : 'rgb(255 255 255 / 0.14)'}
                strokeDasharray={`${segment - gap} ${length - segment + gap}`}
                strokeDashoffset={-(segment * i + gap / 2)}
                className={s === 'running' ? '[animation:pulse-dot_1.2s_ease-in-out_infinite]' : undefined}
                style={{ transition: 'stroke 400ms' }}
              />
            );
          })}
        </svg>
        {/* La lente que llegó del iris: la pupila se dilata para dejar sitio al estado. */}
        <motion.div layoutId={lensId} transition={SPRING} className="absolute inset-[7%] rounded-full">
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full [animation:breathe_2.4s_ease-in-out_infinite]"
            style={{
              background:
                'radial-gradient(circle at 34% 26%, rgb(255 255 255 / 0.22), transparent 18%), radial-gradient(circle at 50% 52%, var(--pupil) 0 58%, transparent 59%), radial-gradient(circle at 50% 52%, transparent 60%, rgb(var(--bg-rgb) / 0.5) 96%), conic-gradient(from 210deg at 50% 52%, var(--azure), var(--iris) 45%, var(--azure) 85%)',
              boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.18), -24px 0 80px -20px rgb(var(--azure-rgb) / 0.5), 24px 0 80px -20px rgb(var(--iris-rgb) / 0.5)',
            }}
          />
          <motion.div
            className="absolute inset-[22%] grid content-center justify-items-center text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <span className="text-sm text-text-muted">Auditando</span>
            <span className="mt-1 text-xl font-medium tracking-[-0.02em] text-text">{current ? PHASE_LABEL[current.phase] : 'Preparando'}</span>
            <span className="mt-2 max-w-full truncate font-mono text-xs text-text-muted">{state.url}</span>
          </motion.div>
        </motion.div>
      </div>
      <ol className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Fases de la auditoría">
        {states.map(({ phase, state: s }) => (
          <li
            key={phase}
            className={`shine inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm ${s === 'pending' ? 'text-text-muted' : 'bg-surface text-text'}`}
          >
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${s === 'done' ? 'bg-azure' : s === 'running' ? 'bg-azure-strong [animation:pulse-dot_1.2s_ease-in-out_infinite]' : 'bg-white/20'}`}
            />
            {PHASE_LABEL[phase]}
            <span className="text-text-muted">{label[s]}</span>
          </li>
        ))}
      </ol>
      {/* Solo visual: el aviso para lectores de pantalla es la región viva del observatorio, por fases. */}
      <p className="mt-4 max-w-md text-center text-sm text-text-muted">{lastMessage}</p>
    </div>
  );
}

function ErrorLens({ message, onRetry, onSample }: { message: string; onRetry: () => void; onSample: () => void }) {
  return (
    <div className="mx-auto grid w-full max-w-[34rem] place-items-center">
      <motion.div
        role="alert"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING}
        className="sphere grid w-full justify-items-center rounded-[3rem] px-8 py-12 text-center"
      >
        <AlertTile size={40} />
        <p className="mt-5 text-xl font-medium tracking-[-0.02em] text-text">La auditoría no ha podido terminar</p>
        <p className="mt-2 max-w-sm text-text-muted">{message}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-12 items-center rounded-full bg-lens px-6 font-medium text-on-cta shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] transition-[background-color,transform] hover:bg-lens-hover active:scale-[0.98]"
          >
            Probar otra URL
          </button>
          <button type="button" onClick={onSample} className="shine inline-flex min-h-12 items-center rounded-full bg-surface px-6 font-medium text-text transition-colors hover:bg-surface-2 active:scale-[0.98]">
            Volver a la muestra
          </button>
        </div>
      </motion.div>
    </div>
  );
}

'use client';

/**
 * El auditor completo: el primer pantallazo (titular, iris y observatorio) y el informe debajo.
 *
 * Una sola lente recorre los tres estados con layoutId: está en el iris mientras se espera la URL,
 * vuela al observatorio y late mientras audita, y al terminar se convierte en el núcleo de los
 * anillos del nuevo informe. Cada auditoría estrena una lente (`iris-n`), así nunca hay dos piezas
 * montadas con la misma identidad.
 *
 * Antes de auditar nada se enseña la auditoría real de /demo. Mientras audita, el informe de abajo
 * se va llenando con lo provisional; al terminar, si es la misma página que la vez anterior, dice
 * qué cambió.
 *
 * Para lectores de pantalla hay una sola región viva: anuncia la fase en curso y el resultado. El
 * registro se puede leer entero, pero no se anuncia línea a línea.
 */
import { compareReports, samePage, type ReportComparison } from '@lupa11y/core/compare';
import { PHASE_LABEL, SEVERITY_LABEL } from '@lupa11y/core/format';
import { SEVERITIES, SOURCES, type Finding, type Report } from '@lupa11y/core/schema';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { liveReport } from '@/lib/live-report';
import { useAuditStream, type AuditState } from '@/lib/use-audit-stream';
import { AuditOrb } from './audit-orb';
import { linesFromLog, linesFromReport } from './console-panel';
import { IrisInput } from './iris-input';
import { findingIdOf, targetsFor } from './model';
import { ReportPanel } from './report-panel';
import { useReportView } from './view-state';

const zeros = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

/** Lo que se anuncia: la fase en curso mientras audita y el recuento al terminar. Los errores ya se anuncian solos. */
function announcementFor(state: AuditState, comparison: ReportComparison | null): string {
  if (state.status === 'running') {
    const entry = [...state.log].reverse().find((e) => e.event.type === 'phase' && e.event.state === 'running');
    return entry?.event.type === 'phase' ? `Auditando: ${PHASE_LABEL[entry.event.phase]}.` : `Auditando ${state.url ?? ''}.`;
  }
  if (state.status === 'done' && state.report) {
    const { total, bySeverity } = state.report.summary;
    const parts = SEVERITIES.filter((s) => bySeverity[s] > 0).map((s) => `${bySeverity[s]} de severidad ${SEVERITY_LABEL[s].toLowerCase()}`);
    const changes = comparison ? ` Frente a la vez anterior: ${comparison.resolved.length} resueltas y ${comparison.added.length} nuevas.` : '';
    return `Auditoría terminada: ${total} hallazgos${parts.length ? ` (${parts.join(', ')})` : ''}.${changes} El informe está más abajo.`;
  }
  return '';
}

export function Observatory({ sample }: { sample: Report }) {
  const { state, start, cancel, reset } = useAuditStream();
  const { view, dispatch, actions, activeKey } = useReportView(sample);
  const [runs, setRuns] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const running = state.status === 'running';
  const finished = state.report ?? sample;
  const isSample = state.report === null;
  // Mientras audita: lo provisional, o un informe vacío hasta que llega la captura.
  const blank = useMemo<Report>(
    () => ({ ...sample, findings: [], keyboard: null, screenshot: null, phases: [], summary: { total: 0, bySeverity: zeros(SEVERITIES), bySource: zeros(SOURCES) } }),
    [sample],
  );
  const live = useMemo(() => (state.live && state.startedIso ? liveReport(state.live, state.startedIso) : null), [state.live, state.startedIso]);
  const report = running ? (live ?? blank) : finished;
  const targets = useMemo(() => targetsFor(report, view.visible), [report, view.visible]);
  const comparison = useMemo(
    () => (state.report && state.previous && samePage(state.previous, state.report) ? compareReports(state.previous, state.report) : null),
    [state.report, state.previous],
  );

  const run = async (url: string) => {
    setRuns((n) => n + 1);
    dispatch({ type: 'run-started' });
    const result = await start(url);
    if (result) dispatch({ type: 'show-report', report: result });
  };

  const backToSample = () => {
    reset();
    dispatch({ type: 'show-report', report: sample });
    inputRef.current?.focus();
  };

  // Una burbuja abre su hallazgo en el informe y lleva la vista hasta él.
  const selectFinding = (finding: Finding) => {
    dispatch({ type: 'open-finding', finding, at: Date.now() });
    document.getElementById('informe')?.scrollIntoView({ block: 'start' });
  };

  const caption =
    state.status === 'running' ? 'Auditoría en curso: lo que ves es provisional' : state.report ? 'Auditoría en directo' : 'Muestra: auditoría real de /demo';

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {announcementFor(state, comparison)}
        </p>
        <section id="auditor" aria-labelledby="hero-title" className="relative isolate overflow-hidden">
          <BackdropLenses />
          <div className="mx-auto grid min-h-[100dvh] max-w-336 items-center gap-x-10 gap-y-14 px-4 pb-20 pt-32 sm:px-6 lg:grid-cols-12 lg:pb-16 lg:pt-28">
            <div className="lg:col-span-7">
              <h1 id="hero-title" className="text-[clamp(2.6rem,1.4rem+3.6vw,4rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-text">
                <span className="block overflow-hidden pb-[0.08em]">
                  <span className="enter-line">Auditoría de accesibilidad</span>
                </span>
                <span className="block overflow-hidden pb-[0.08em]">
                  <span className="enter-line text-text-muted" style={{ '--d': '90ms' } as CSSProperties}>
                    que pulsa <span className="text-iris-strong">Tab.</span>
                  </span>
                </span>
              </h1>
              <p className="enter mt-6 max-w-[34ch] text-lg leading-relaxed text-text-muted sm:text-xl" style={{ '--d': '220ms' } as CSSProperties}>
                Recorre tu web con el teclado, mide el foco píxel a píxel y te da cada arreglo en código.
              </p>
              <div className="enter mt-10" style={{ '--d': '340ms' } as CSSProperties}>
                <IrisInput ref={inputRef} running={running} lensId={`iris-${runs + 1}`} onSubmit={run} onCancel={cancel} />
              </div>
            </div>
            <div className="lg:col-span-5">
              <AuditOrb
                state={state}
                report={finished}
                isSample={isSample}
                lensId={`iris-${runs}`}
                activeFindingId={findingIdOf(activeKey)}
                onSelectFinding={selectFinding}
                onRetry={() => inputRef.current?.focus()}
                onSample={backToSample}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="informe-title" className="mx-auto max-w-336 px-4 pb-28 sm:px-6 lg:pb-36">
          <div id="informe" className="mb-10 max-w-2xl px-2">
            <h2 id="informe-title" className="reveal text-[clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-text">
              El informe, hallazgo a hallazgo.
            </h2>
            <p className="reveal mt-4 text-lg leading-relaxed text-text-muted">
              Cada hallazgo dice de qué fase sale, qué criterio WCAG incumple, en qué elemento está y cómo se arregla.
            </p>
          </div>
          <ReportPanel
            report={report}
            targets={targets}
            view={view}
            actions={actions}
            activeKey={activeKey}
            viewportRef={viewportRef}
            status={state.status}
            pendingUrl={state.url}
            log={{ lines: state.status === 'idle' ? linesFromReport(sample) : linesFromLog(state.log, state.startedAt ?? 0), live: running }}
            caption={caption}
            comparison={comparison}
            share={running ? null : { savedPath: state.savedPath }}
          />
        </section>
      </LayoutGroup>
    </MotionConfig>
  );
}

/**
 * Tres lentes translúcidas que se superponen en modo «pantalla» detrás del observatorio: donde se
 * cruzan, la luz se suma. Derivan muy despacio y solo transforman; con movimiento reducido, quietas.
 * En pantallas estrechas el observatorio va debajo del texto: las lentes bajan con él y pierden el
 * canto, para que ninguna curva cruce el titular.
 */
function BackdropLenses() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <span
        className="backdrop-lens left-[50%] top-[8%] size-[38rem] [animation:drift-a_38s_ease-in-out_infinite] max-lg:left-[-10%] max-lg:top-[54%] max-lg:size-[26rem] max-lg:shadow-none!"
        style={{
          background: 'radial-gradient(circle at 38% 30%, rgb(var(--azure-rgb) / 0.17), rgb(var(--azure-shade-rgb) / 0.1) 46%, rgb(var(--azure-shade-rgb) / 0.04) 70%)',
          boxShadow: 'inset 0 0 0 1px rgb(var(--azure-rgb) / 0.14), inset 0 0 80px rgb(var(--azure-rgb) / 0.06)',
        }}
      />
      <span
        className="backdrop-lens left-[66%] top-[34%] size-[30rem] [animation:drift-b_44s_ease-in-out_infinite] max-lg:left-[30%] max-lg:top-[62%] max-lg:size-[22rem] max-lg:shadow-none!"
        style={{
          background: 'radial-gradient(circle at 40% 32%, rgb(var(--iris-rgb) / 0.15), rgb(var(--iris-shade-rgb) / 0.08) 50%, rgb(var(--iris-shade-rgb) / 0.03) 72%)',
          boxShadow: 'inset 0 0 0 1px rgb(var(--iris-rgb) / 0.13), inset 0 0 70px rgb(var(--iris-rgb) / 0.05)',
        }}
      />
      <span
        className="backdrop-lens left-[42%] top-[46%] size-[26rem] [animation:drift-c_52s_ease-in-out_infinite] max-lg:left-[5%] max-lg:top-[72%] max-lg:size-[18rem] max-lg:shadow-none!"
        style={{
          background: 'radial-gradient(circle at 42% 34%, rgb(var(--teal-rgb) / 0.12), rgb(var(--teal-shade-rgb) / 0.06) 55%, rgb(var(--teal-shade-rgb) / 0.02) 74%)',
          boxShadow: 'inset 0 0 0 1px rgb(var(--teal-rgb) / 0.1)',
        }}
      />
      {/* Un velo que funde el fondo con la sección siguiente sin una línea. */}
      <span className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}

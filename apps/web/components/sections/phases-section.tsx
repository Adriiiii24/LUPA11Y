/**
 * «Cómo funciona»: las tres fases como lentes que se superponen, con el área de cada una
 * proporcional a lo que tardó en la auditoría real de muestra. Al elegir una, al lado aparece su
 * prueba sacada del propio informe.
 *
 * Este componente de servidor extrae solo lo que hace falta del informe (sin la captura entera) y
 * se lo pasa a la parte interactiva.
 */
import { PHASE_STATUS_LABEL } from '@lupa11y/core/format';
import type { Finding, Report } from '@lupa11y/core/schema';
import { formatMs } from '../observatory/model';
import { PhaseLenses, type PhaseLens } from './phase-lenses';

const find = (report: Report, id: string): Finding | undefined => report.findings.find((f) => f.id === id);

export function PhasesSection({ report }: { report: Report }) {
  const phase = (id: string) => report.phases.find((p) => p.id === id);
  const axe = phase('axe');
  const keyboard = phase('keyboard');
  const vision = phase('vision');
  const load = phase('load');
  const layout = phase('layout');
  // La visión puede pasar tiempo esperando la cuota de Google (el plan gratuito): eso no es trabajo del modelo.
  const visionWait = vision?.waitedMs ?? 0;
  const visionActive = vision ? Math.max(0, vision.durationMs - visionWait) : 0;

  const contrast = find(report, 'axe:color-contrast')?.nodes.find((n) => n.fix);
  const invisible = find(report, 'keyboard:focus-invisible')?.nodes[0];
  const invisibleStop = invisible ? report.keyboard?.stops.find((s) => s.selector === invisible.selector) : undefined;
  const trap = find(report, 'keyboard:keyboard-trap');
  const altMismatch = find(report, 'vision:alt-mismatch')?.nodes[0];

  const lenses: PhaseLens[] = [
    {
      id: 'keyboard',
      name: 'Agente de teclado',
      duration: keyboard?.status === 'done' ? formatMs(keyboard.durationMs) : PHASE_STATUS_LABEL[keyboard?.status ?? 'skipped'],
      weight: keyboard?.status === 'done' ? keyboard.durationMs : 0,
      title: 'Un agente que pulsa Tab',
      body: 'Recorre la página con pulsaciones reales y compara cada elemento con foco y sin foco, píxel a píxel. Si no cambia nada, el foco es invisible. Si el foco no puede salir de un grupo, es una trampa.',
      footnote: 'WCAG 2.1.1, 2.1.2, 2.4.7, 2.4.11 y 2.4.13.',
      evidence:
        invisible?.evidence.unfocused && invisible.evidence.focused
          ? {
              kind: 'focus',
              unfocused: invisible.evidence.unfocused,
              focused: invisible.evidence.focused,
              name: invisibleStop?.name ?? 'Cafés',
              required: invisibleStop?.focus.requiredArea ?? null,
              trap: trap?.occurrences ?? null,
            }
          : null,
    },
    {
      id: 'axe',
      name: 'axe-core',
      duration: axe?.status === 'done' ? formatMs(axe.durationMs) : PHASE_STATUS_LABEL[axe?.status ?? 'skipped'],
      weight: axe?.status === 'done' ? axe.durationMs : 0,
      title: 'Las reglas, con el arreglo calculado',
      body: 'Chromium carga la página y axe-core aplica WCAG 2.2 A y AA. En contraste de color, el motor busca el tono más cercano que cumple la ratio moviendo solo la luminosidad.',
      evidence: contrast?.fix ? { kind: 'diff', fix: contrast.fix } : null,
    },
    {
      id: 'vision',
      name: 'Gemini Vision',
      duration: vision?.status === 'done' ? formatMs(visionActive) : PHASE_STATUS_LABEL[vision?.status ?? 'skipped'],
      weight: vision?.status === 'done' ? visionActive : 0,
      title: 'El modelo, solo donde las reglas no alcanzan',
      body: 'axe sabe si una imagen tiene alt, pero no si ese alt dice la verdad. El modelo mira la imagen y responde con un esquema cerrado.',
      evidence: altMismatch?.fix
        ? { kind: 'diff', fix: altMismatch.fix }
        : {
            kind: 'note',
            text: `En esta muestra la visión está ${vision ? PHASE_STATUS_LABEL[vision.status] : 'omitida'}: no había clave de Gemini al generarla. El resto del informe no depende de ella.`,
          },
    },
  ];

  return (
    <section aria-labelledby="como-funciona-title" className="mx-auto max-w-336 px-4 py-28 sm:px-6 lg:py-36">
      <div id="como-funciona" className="max-w-2xl px-2">
        <h2 id="como-funciona-title" className="reveal text-[clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-text">
          Primero se mide. Después, el modelo.
        </h2>
        <p className="reveal mt-4 text-lg leading-relaxed text-text-muted">
          Tres lentes sobre la misma página. El tamaño de cada una es lo que tardó en la auditoría de muestra.
        </p>
      </div>
      <PhaseLenses
        lenses={lenses}
        summary={`Carga de la página: ${load ? formatMs(load.durationMs) : 'sin medir'}.${
          layout?.status === 'done' ? ` Reflujo a 320 px y espaciado de texto: ${formatMs(layout.durationMs)}.` : ''
        } Total: ${formatMs(report.durationMs - visionWait)}${vision?.status === 'done' ? ', con la visión en paralelo al teclado' : ''}.${
          visionWait >= 1_000 ? ` Aparte, ${formatMs(visionWait)} esperando la cuota gratuita de Gemini.` : ''
        }`}
      />
    </section>
  );
}

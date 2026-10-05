'use client';

/**
 * Una burbuja por hallazgo, en órbita alrededor de los anillos. El tamaño y el tono dicen la
 * gravedad, pero nunca solos: cada burbuja es un botón con su nombre completo, muestra el número que
 * el hallazgo tiene en la lista y abre su detalle en el informe.
 *
 * El área que se puede pulsar mide al menos 44 px aunque la burbuja visible sea más pequeña (un
 * pseudoelemento la amplía), así el tamaño sigue diciendo la gravedad también en móvil.
 */
import { SEVERITY_LABEL } from '@lupa11y/core/format';
import type { Finding, Report } from '@lupa11y/core/schema';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { SEVERITY_SIZE, SEVERITY_TONE } from './model';

const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

/** Radio de la órbita y diámetro de la burbuja mayor, en proporción al lado del contenedor. */
const ORBIT = 0.415;
const LARGEST = 0.15;

interface FindingBubblesProps {
  report: Report;
  activeId: string | null;
  onSelect: (finding: Finding) => void;
}

export function FindingBubbles({ report, activeId, onSelect }: FindingBubblesProps) {
  const findings = report.findings;
  const count = Math.max(1, findings.length);

  return (
    <ul aria-label="Hallazgos por gravedad" className="absolute inset-0">
      {findings.map((finding, index) => {
        // Reparto regular con un desfase alterno, para que no parezca una rueda dentada.
        const angle = (-70 + (index / count) * 360 + (index % 2 ? 7 : -4)) * (Math.PI / 180);
        const orbit = ORBIT + (index % 3 === 0 ? 0.012 : index % 3 === 1 ? -0.01 : 0);
        const size = LARGEST * SEVERITY_SIZE[finding.severity];
        const tone = SEVERITY_TONE[finding.severity];
        const active = activeId === finding.id;
        // La etiqueta sale hacia fuera de la órbita: arriba si la burbuja está en la mitad de arriba,
        // abajo si no, y alineada hacia el centro en los costados para no salirse de la página.
        const cos = Math.cos(angle);
        const vertical = Math.sin(angle) < 0 ? 'bottom-full mb-2.5' : 'top-full mt-2.5';
        const horizontal = cos > 0.35 ? 'right-0' : cos < -0.35 ? 'left-0' : 'left-1/2 -translate-x-1/2';
        return (
          <motion.li
            key={`${report.auditedAt}-${finding.id}`}
            // Cada burbuja es su propio contexto de apilado (por su animación): la que se señala sube
            // por encima de las demás para que su etiqueta no quede tapada.
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 focus-within:z-30 hover:z-30"
            style={{ left: `${(0.5 + Math.cos(angle) * orbit) * 100}%`, top: `${(0.5 + Math.sin(angle) * orbit) * 100}%`, width: `${size * 100}%` }}
            initial={{ opacity: 0, scale: 0.8, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.55 + index * 0.06 }}
          >
            <button
              type="button"
              onClick={() => onSelect(finding)}
              aria-pressed={active}
              aria-label={`${index + 1}. ${SEVERITY_LABEL[finding.severity]}: ${finding.title}. ${finding.occurrences === 1 ? '1 elemento' : `${finding.occurrences} elementos`}.`}
              className="group relative grid aspect-square w-full place-items-center rounded-full before:absolute before:inset-[min(0px,calc((100%-2.75rem)/2))] before:rounded-full before:content-['']"
            >
              <span
                aria-hidden="true"
                className="float-bubble absolute inset-0 grid place-items-center rounded-full transition-transform duration-300 ease-lens group-hover:scale-110"
                style={
                  {
                    '--float': `${-5 - (index % 4) * 1.5}px`,
                    animationDuration: `${5.5 + (index % 5) * 0.9}s`,
                    animationDelay: `${-index * 0.7}s`,
                    background: `radial-gradient(circle at 32% 26%, rgb(255 255 255 / 0.18), transparent 38%), radial-gradient(circle at 50% 60%, ${tone}33, transparent 72%), var(--surface)`,
                    boxShadow: `inset 0 0 0 ${active ? 2.5 : 1.5}px ${tone}, 0 0 ${active ? 34 : 22}px -6px ${tone}${active ? 'cc' : '88'}`,
                  } as CSSProperties
                }
              >
                <span className="font-mono text-[0.8125rem] font-medium tabular-nums text-text">{index + 1}</span>
              </span>
              {/* La etiqueta aparece al pasar o enfocar; el nombre accesible ya lo dice todo. */}
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute ${vertical} ${horizontal} w-max max-w-[15rem] rounded-2xl bg-raised px-4 py-2.5 text-left text-[0.8125rem] leading-snug text-text opacity-0 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),0_18px_40px_-12px_rgb(0_0_0/0.9)] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100`}
              >
                <span className="text-text-muted">{SEVERITY_LABEL[finding.severity]}.</span> {finding.title}
              </span>
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

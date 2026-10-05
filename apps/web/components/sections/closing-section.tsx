import { IconArrowRight } from '../icons';

/**
 * El cierre: una lente grande con lo que LupA11y promete y lo que no. En móvil la lente se convierte
 * en una cápsula, porque un círculo de 360 px no deja leer.
 */
export function ClosingSection() {
  return (
    <section aria-labelledby="cierre-title" className="relative isolate overflow-hidden px-4 py-28 sm:px-6 lg:py-36">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(56rem,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle at 38% 50%, rgb(var(--azure-shade-rgb) / 0.24), transparent 58%), radial-gradient(circle at 62% 50%, rgb(var(--sev-low-rgb) / 0.24), transparent 58%)' }}
      />
      <div className="reveal sphere mx-auto grid max-w-[44rem] place-items-center rounded-[3rem] px-8 py-16 text-center sm:aspect-square sm:rounded-full sm:px-20">
        <div>
          <h2 id="cierre-title" className="text-[clamp(2.25rem,1.6rem+2.4vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-text">
            Evidencia, no promesas.
          </h2>
          <p className="mx-auto mt-5 max-w-[42ch] text-lg leading-relaxed text-text-muted">
            Ninguna herramienta automática certifica WCAG. LupA11y te da el mapa y los arreglos; el orden de lectura y los contenidos complejos los revisa una persona.
          </p>
          <a
            href="#auditor"
            className="mt-9 inline-flex min-h-14 items-center gap-2 rounded-full bg-lens px-8 text-[1.0625rem] font-medium text-on-cta no-underline shadow-[inset_0_1px_0_rgb(255_255_255/0.7),-12px_18px_50px_-20px_rgb(var(--azure-rgb)/0.7),12px_18px_50px_-20px_rgb(var(--iris-rgb)/0.7)] transition-[background-color,transform] duration-200 hover:bg-lens-hover active:scale-[0.98]"
          >
            Auditar una URL <IconArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * Normativa: las cuatro fechas del Acta Europea de Accesibilidad sobre una curva, la vigente como
 * una lente encendida, los hechos que cuelgan de ella y el comprobador. Datos verificados el
 * 2026-09-30 contra el BOE y la directiva. Nada de cifras inventadas ni de alarmismo.
 */
import type { CSSProperties, ReactNode } from 'react';
import { IconExternal } from '../icons';
import { PALETTE } from '../palette';
import { EaaChecker } from './eaa-checker';
import { Wave } from './wave';

interface Stop {
  date: string;
  dateLabel: string;
  title: string;
  body: ReactNode;
  current?: boolean;
  facts?: Array<{ term: string; body: ReactNode }>;
}

const STOPS: Stop[] = [
  {
    date: '2019',
    dateLabel: '2019',
    title: 'La UE aprueba el Acta Europea de Accesibilidad',
    body: 'Directiva (UE) 2019/882: requisitos comunes de accesibilidad para productos y servicios.',
  },
  {
    date: '2023',
    dateLabel: '2023',
    title: 'España la transpone',
    body: (
      <>
        Con la <strong className="font-medium text-text">Ley 11/2023</strong>, de 8 de mayo.
      </>
    ),
  },
  {
    date: '28.06.2025',
    dateLabel: '28 de junio de 2025',
    title: 'Se aplica',
    body: 'Desde ese día, los servicios que se lanzan o se renuevan tienen que cumplirla.',
    current: true,
    facts: [
      {
        term: 'A quién afecta',
        body: 'Comercio electrónico, banca para consumidores, transporte de viajeros, comunicaciones electrónicas y libros electrónicos, entre otros.',
      },
      {
        term: 'Con qué se mide',
        body: (
          <>
            Con la norma <strong className="font-medium text-text">EN 301 549</strong>, que remite a WCAG 2.1 AA. LupA11y audita WCAG 2.2 AA, que la incluye.
          </>
        ),
      },
      {
        term: 'Qué se arriesga',
        body: 'Multas de 301 € a 1.000.000 € según la gravedad (RDL 1/2013). Leves hasta 30.000 € y graves hasta 90.000 €.',
      },
      {
        term: 'Quién queda fuera',
        body: 'Las microempresas que prestan servicios: menos de 10 personas y hasta 2 M€ de facturación o balance.',
      },
    ],
  },
  {
    date: '28.06.2030',
    dateLabel: '28 de junio de 2030',
    title: 'Termina el margen',
    body: 'Lo que ya se usaba para prestar el servicio antes de junio de 2025 puede seguir usándose hasta entonces.',
  },
];

/** Altura de cada parada sobre la curva (px), para que la línea ondule entre las cuatro fechas. */
const CURVE_Y = [64, 30, 78, 40];

/** La curva pasa por el centro de cada columna (12,5 %, 37,5 %…) y sale por los bordes. */
function curvePath(): string {
  const ys = CURVE_Y;
  const points: Array<[number, number]> = [[0, ys[0]! + 12], ...ys.map((y, i): [number, number] => [50 + i * 100, y]), [400, ys[ys.length - 1]! + 14]];
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}, ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function RegulationSection() {
  const current = STOPS.find((stop) => stop.current);
  return (
    <section aria-labelledby="normativa-title">
      <Wave />
      <div className="bg-raised">
        <div className="mx-auto max-w-336 px-4 py-24 sm:px-6 lg:py-32">
          <div id="normativa" className="max-w-2xl px-2">
            <h2 id="normativa-title" className="reveal text-[clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-text">
              El Acta Europea de Accesibilidad ya se aplica.
            </h2>
            <p className="reveal mt-4 text-lg leading-relaxed text-text-muted">
              Si vendes en línea en la UE, tu web debe cumplir WCAG 2.1 AA. Una auditoría automática no lo certifica, pero te dice por dónde empezar.
            </p>
          </div>

          {/* Las fechas sobre una curva: en escritorio ondulan; en móvil bajan en columna. */}
          <ol className="relative mt-16 grid gap-10 lg:mt-20 lg:grid-cols-4 lg:gap-0" aria-label="Calendario del Acta Europea de Accesibilidad">
            <svg aria-hidden="true" viewBox="0 0 400 110" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 hidden h-[110px] w-full overflow-visible lg:block">
              <defs>
                <linearGradient id="eaa-curve" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={PALETTE.azure} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={PALETTE.iris} stopOpacity="0.55" />
                </linearGradient>
              </defs>
              <path
                d={curvePath()}
                fill="none"
                stroke="url(#eaa-curve)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {STOPS.map((stop, index) => (
              <li key={stop.date} className="relative grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 lg:block lg:px-3">
                <span aria-hidden="true" className="relative block h-14 lg:h-[110px]">
                  <span
                    className="absolute left-0 top-0 grid size-14 place-items-center lg:left-1/2 lg:top-(--y) lg:-translate-x-1/2 lg:-translate-y-1/2"
                    style={{ '--y': `${CURVE_Y[index]}px` } as CSSProperties}
                  >
                    {stop.current ? (
                      <span className="lens-iris block size-14 rounded-full shadow-[-14px_0_50px_-8px_rgb(var(--azure-rgb)/0.6),14px_0_50px_-8px_rgb(var(--iris-rgb)/0.6)]" />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-full bg-surface shadow-[inset_0_0_0_1.5px_rgb(var(--azure-rgb)/0.5),0_0_24px_-6px_rgb(var(--azure-rgb)/0.45)]">
                        <span className="size-2 rounded-full bg-iris/80" />
                      </span>
                    )}
                  </span>
                </span>
                <div className="lg:mt-6 lg:px-2 lg:text-center">
                  <p className="font-mono text-[clamp(1.5rem,1.2rem+1vw,2rem)] leading-none tracking-[-0.03em] text-text">
                    <span aria-hidden="true">{stop.date}</span>
                    <span className="visually-hidden">{stop.dateLabel}</span>
                  </p>
                  <h3 className="mt-3 flex flex-wrap items-center gap-2 text-lg font-medium text-text lg:justify-center">
                    {stop.title}
                    {stop.current ? <span className="bg-lens rounded-full px-3 py-0.5 text-sm font-medium text-on-cta">En vigor</span> : null}
                  </h3>
                  <p className="mt-1.5 leading-relaxed text-text-muted lg:mx-auto lg:max-w-[28ch]">{stop.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-20 grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
            {current?.facts ? (
              <dl className="shine grid content-start gap-x-10 gap-y-8 rounded-[2.5rem] bg-surface p-8 sm:grid-cols-2 sm:p-10 lg:col-span-7">
                {current.facts.map((fact) => (
                  <div key={fact.term}>
                    <dt className="flex items-center gap-2.5 font-medium text-text">
                      <span aria-hidden="true" className="size-2 rounded-full bg-iris shadow-[0_0_10px_rgb(var(--iris-rgb)/0.8)]" />
                      {fact.term}
                    </dt>
                    <dd className="mt-2 leading-relaxed text-text-muted">{fact.body}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="lg:col-span-5">
              <EaaChecker />
              <p className="mt-4 flex flex-wrap gap-x-2 gap-y-1 px-2 text-sm text-text-muted">
                <a
                  href="https://www.boe.es/buscar/act.php?id=BOE-A-2023-11022"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-text underline decoration-white/30 hover:decoration-azure"
                >
                  Ley 11/2023 en el BOE <IconExternal size={14} />
                  <span className="visually-hidden"> (se abre en otra pestaña)</span>
                </a>
                <a
                  href="https://eur-lex.europa.eu/eli/dir/2019/882/oj"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-text underline decoration-white/30 hover:decoration-azure"
                >
                  Directiva (UE) 2019/882 <IconExternal size={14} />
                  <span className="visually-hidden"> (se abre en otra pestaña)</span>
                </a>
                <span className="inline-flex min-h-11 items-center px-3">Información orientativa, no asesoramiento legal.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      <Wave flip />
    </section>
  );
}

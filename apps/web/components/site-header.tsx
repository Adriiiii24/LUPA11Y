import { IconArrowRight } from './icons';
import { Logo } from './logo';

const LINKS = [
  { href: '#informe', label: 'Informe' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#normativa', label: 'Normativa' },
  { href: '#integraciones', label: 'Integraciones' },
];

/**
 * Navegación en una píldora flotante: se separa del contenido por su propio volumen, no por un filete.
 * Fuera de la landing (un informe guardado) los enlaces vuelven a sus secciones en la portada.
 */
export function SiteHeader({ home = true }: { home?: boolean }) {
  const base = home ? '' : '/';
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="shine-strong pointer-events-auto mx-auto flex h-16 max-w-280 items-center gap-4 rounded-full bg-raised/85 pl-5 pr-2 backdrop-blur-md">
        <a href={`${base}#auditor`} className="inline-flex min-h-11 items-center rounded-full pr-2 text-text no-underline">
          <Logo priority />
          <span className="visually-hidden">, inicio</span>
        </a>
        <nav aria-label="Secciones" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={`${base}${link.href}`}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] text-text-muted no-underline transition-colors duration-200 hover:bg-white/6 hover:text-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href={`${base}#auditor`}
          className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-lens px-5 text-[0.9375rem] font-medium text-on-cta no-underline shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] transition-[background-color,transform] duration-200 hover:bg-lens-hover active:scale-[0.98] lg:ml-2"
        >
          Auditar una URL <IconArrowRight size={16} />
        </a>
      </div>
    </header>
  );
}

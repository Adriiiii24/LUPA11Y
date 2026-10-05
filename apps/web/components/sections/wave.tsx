/**
 * La transición entre el fondo y una banda elevada: una onda suave en lugar de una línea recta.
 * `flip` la gira para cerrar la banda por abajo.
 */
export function Wave({ flip = false }: { flip?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 1440 120" preserveAspectRatio="none" className={`block h-16 w-full sm:h-24 ${flip ? 'rotate-180' : ''}`}>
      <path d="M0 120 L0 74 C 240 18, 480 12, 720 46 S 1200 104, 1440 40 L1440 120 Z" fill="var(--raised)" />
    </svg>
  );
}

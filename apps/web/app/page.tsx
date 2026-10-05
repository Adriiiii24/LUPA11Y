import { toMarkdown } from '@lupa11y/core/format';
import { Logo } from '@/components/logo';
import { Observatory } from '@/components/observatory/observatory';
import { ClosingSection } from '@/components/sections/closing-section';
import { EcosystemSection } from '@/components/sections/ecosystem-section';
import { PhasesSection } from '@/components/sections/phases-section';
import { RegulationSection } from '@/components/sections/regulation-section';
import { SiteHeader } from '@/components/site-header';
import { lightSampleReport, sampleReport } from '@/lib/server/sample';

/**
 * Auditoría real de /demo, generada con `npm run sample` y validada contra el contrato al construir.
 * Al cliente viaja sin las imágenes dentro: cada una es una URL de `/sample/<clave>`.
 */
const sample = lightSampleReport();

/** Extracto de lo que devuelve la herramienta MCP para la misma auditoría. */
const mcpSample = toMarkdown(sampleReport(), { maxFindings: 2 })
  .split('\n')
  .filter((line) => !line.startsWith('- `') || line.length < 180)
  .slice(0, 34)
  .join('\n');

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Observatory sample={sample} />
        <PhasesSection report={sample} />
        <RegulationSection />
        <EcosystemSection mcpSample={mcpSample} />
        <ClosingSection />
      </main>

      <footer className="px-4 pb-10 sm:px-6">
        <div className="shine mx-auto flex max-w-280 flex-col items-center gap-4 rounded-[2.5rem] bg-raised px-8 py-8 text-center sm:flex-row sm:rounded-full sm:py-6 sm:text-left">
          <Logo className="text-text" />
          <div className="text-sm text-text-muted sm:ml-auto sm:text-right">
            <p lang="en" className="text-text">
              Agentic Accessibility Auditing: Deterministic Precision meets Visual Intelligence.
            </p>
            <p className="mt-0.5">Proyecto de Adrián Martínez Panés.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

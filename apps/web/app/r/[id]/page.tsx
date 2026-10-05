/**
 * /r/<id>: un informe guardado por la API, para compartirlo. Solo existe si el despliegue activa
 * los enlaces permanentes (`LUPA11Y_REPORTS_DIR`); caduca y no se indexa.
 */
import { SEVERITIES } from '@lupa11y/core/schema';
import { SEVERITY_LABEL } from '@lupa11y/core/format';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconArrowRight } from '@/components/icons';
import { SavedReport } from '@/components/observatory/saved-report';
import { SiteHeader } from '@/components/site-header';
import { externalizeImages } from '@/lib/server/report-images';
import { reportStore } from '@/lib/server/report-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const report = await reportStore()?.load(id);
  return {
    title: report ? `Informe de accesibilidad de ${hostOf(report.finalUrl)} · LupA11y` : 'Informe no encontrado · LupA11y',
    robots: { index: false, follow: false },
  };
}

export default async function SavedReportPage({ params }: Params) {
  const { id } = await params;
  const report = await reportStore()?.load(id);
  if (!report) notFound();
  const light = externalizeImages(report, `/r/${id}/img`);
  const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(report.auditedAt));
  const counts = SEVERITIES.filter((s) => report.summary.bySeverity[s] > 0)
    .map((s) => `${report.summary.bySeverity[s]} ${SEVERITY_LABEL[s].toLowerCase()}`)
    .join(', ');

  return (
    <>
      <SiteHeader home={false} />
      <main id="main" className="mx-auto max-w-336 px-4 pb-28 pt-32 sm:px-6 lg:pt-36">
        <div id="informe" className="mb-10 max-w-3xl px-2">
          <h1 className="text-[clamp(2rem,1.4rem+2vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-text">
            Informe de accesibilidad de <span className="break-all text-iris-strong">{hostOf(report.finalUrl)}</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-text-muted">
            <span className="break-all font-mono text-base text-text">{report.finalUrl}</span>, auditada el {date} (UTC) con WCAG 2.2 {report.wcagLevel}.{' '}
            {report.summary.total === 0 ? 'Sin hallazgos automáticos.' : `${report.summary.total} hallazgos: ${counts}.`}
          </p>
          <Link
            href="/#auditor"
            className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-lens px-6 font-medium text-on-cta no-underline shadow-[inset_0_1px_0_rgb(255_255_255/0.6)] transition-[background-color,transform] duration-200 hover:bg-lens-hover active:scale-[0.98]"
          >
            Auditar otra URL <IconArrowRight size={16} />
          </Link>
        </div>
        <SavedReport report={light} savedPath={`/r/${id}`} caption="Informe guardado: caduca a los pocos días y no se indexa." />
      </main>
    </>
  );
}

'use client';

/**
 * Un informe guardado (`/r/<id>`): el mismo visor que la landing, sin el auditor. Se puede filtrar,
 * recorrer, descargar y volver a copiar su enlace.
 */
import type { Report } from '@lupa11y/core/schema';
import { MotionConfig } from 'motion/react';
import { useMemo, useRef } from 'react';
import { linesFromReport } from './console-panel';
import { targetsFor } from './model';
import { ReportPanel } from './report-panel';
import { useReportView } from './view-state';

export function SavedReport({ report, savedPath, caption }: { report: Report; savedPath: string; caption: string }) {
  const { view, actions, activeKey } = useReportView(report);
  const viewportRef = useRef<HTMLDivElement>(null);
  const targets = useMemo(() => targetsFor(report, view.visible), [report, view.visible]);
  return (
    <MotionConfig reducedMotion="user">
      <ReportPanel
        report={report}
        targets={targets}
        view={view}
        actions={actions}
        activeKey={activeKey}
        viewportRef={viewportRef}
        status="done"
        pendingUrl={null}
        log={{ lines: linesFromReport(report), live: false }}
        caption={caption}
        share={{ savedPath }}
      />
    </MotionConfig>
  );
}

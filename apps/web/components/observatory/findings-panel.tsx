'use client';

/**
 * Los hallazgos, en el orden y con el número de sus burbujas. Cerrado, cada uno es su resumen;
 * abierto, despliega en el mismo sitio el selector, el recorte, el diagnóstico y el diff.
 * Entran en cascada, emergiendo desde abajo, cada vez que llega un informe.
 */
import type { Finding, Report, Severity } from '@lupa11y/core/schema';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { DiffView } from '../diff-view';
import { IconChevron } from '../icons';
import { findingIdOf, nodeKey, SEVERITY_TONE, wcagLabel } from './model';
import { SeverityTag, SourceMark } from './severity';

const SPRING = { type: 'spring', stiffness: 100, damping: 20 } as const;

interface FindingsPanelProps {
  report: Report;
  visible: ReadonlySet<Severity>;
  activeKey: string | null;
  /** Hallazgo que se pide abrir desde fuera (una burbuja). */
  openRequest: { id: string; at: number } | null;
  /** Hallazgos que no estaban (o tienen nodos nuevos) en la auditoría anterior de la misma página. */
  newIds?: ReadonlySet<string>;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}

export function FindingsPanel({ report, visible, activeKey, openRequest, newIds, onSelect, onHover }: FindingsPanelProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(report.findings[0] ? [report.findings[0].id] : []));
  const numbered = report.findings.map((finding, index) => ({ finding, number: index + 1 }));
  const shown = numbered.filter(({ finding }) => visible.has(finding.severity));

  // Una burbuja pide abrir su hallazgo: el estado se ajusta en el propio render (sin efecto) y la
  // fila entra en vista después, que eso sí es tocar el DOM.
  const [handled, setHandled] = useState<number | null>(null);
  if (openRequest && openRequest.at !== handled) {
    setHandled(openRequest.at);
    setOpen((current) => new Set(current).add(openRequest.id));
  }
  useEffect(() => {
    if (!openRequest) return;
    const row = document.querySelector<HTMLElement>(`[data-finding-id="${CSS.escape(openRequest.id)}"]`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [openRequest]);

  if (report.findings.length === 0) {
    return (
      <p className="p-6 text-text-muted">
        Ninguna fase ha encontrado problemas automáticos. No es un certificado: revisa a mano el orden de lectura, los formularios y los contenidos multimedia.
      </p>
    );
  }
  if (shown.length === 0) return <p className="p-6 text-text-muted">Ningún hallazgo con las severidades seleccionadas.</p>;

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5 p-2" aria-label="Hallazgos por severidad">
      {shown.map(({ finding, number }, index) => (
        <motion.li
          key={`${report.auditedAt}-${finding.id}`}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...SPRING, delay: Math.min(index, 8) * 0.05 }}
        >
          <FindingItem
            finding={finding}
            number={number}
            expanded={open.has(finding.id)}
            isNew={newIds?.has(finding.id) ?? false}
            activeKey={activeKey}
            onToggle={() => {
              toggle(finding.id);
              const first = finding.nodes.findIndex((n) => n.rect);
              if (first !== -1) onSelect(nodeKey(finding, first));
            }}
            onSelect={onSelect}
            onHover={onHover}
          />
        </motion.li>
      ))}
    </ol>
  );
}

function FindingItem({
  finding,
  number,
  expanded,
  isNew,
  activeKey,
  onToggle,
  onSelect,
  onHover,
}: {
  finding: Finding;
  number: number;
  expanded: boolean;
  isNew: boolean;
  activeKey: string | null;
  onToggle: () => void;
  onSelect: (key: string) => void;
  onHover: (key: string | null) => void;
}) {
  const firstWithRect = finding.nodes.findIndex((n) => n.rect);
  const itemKey = firstWithRect === -1 ? null : nodeKey(finding, firstWithRect);
  const isActive = findingIdOf(activeKey) === finding.id;
  const panelId = `finding-${finding.id.replace(/[^a-z0-9-]/gi, '-')}`;
  const tone = SEVERITY_TONE[finding.severity];

  return (
    <div
      data-item-key={itemKey ?? undefined}
      data-finding-id={finding.id}
      className={`rounded-[1.75rem] transition-[background-color,box-shadow] duration-300 ${isActive ? 'bg-surface-2 shadow-[inset_0_0_0_1px_rgb(var(--azure-rgb)/0.45)]' : 'hover:bg-white/3'}`}
      onMouseEnter={() => onHover(itemKey)}
      onMouseLeave={() => onHover(null)}
    >
      <h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-[1.75rem] px-4 py-4 text-left"
        >
          {/* El mismo número y la misma lente que su burbuja en el observatorio. */}
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-surface font-mono text-[0.8125rem] tabular-nums text-text"
            style={{ boxShadow: `inset 0 0 0 1.5px ${tone}, 0 0 16px -6px ${tone}` }}
          >
            {number}
          </span>
          <span className="pt-1.5 text-[0.9375rem] font-medium leading-snug text-text">{finding.title}</span>
          <IconChevron size={16} className={`mt-2 text-text-muted transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
          <span className="col-start-2 col-end-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-muted">
            {isNew ? (
              <span className="rounded-full bg-azure-strong px-2.5 py-0.5 text-[0.8125rem] font-medium text-on-cta">
                Nuevo<span className="visually-hidden"> desde la auditoría anterior</span>
              </span>
            ) : null}
            <SeverityTag severity={finding.severity} />
            <SourceMark source={finding.source} />
            <span>{wcagLabel(finding)}</span>
            <span className="font-mono text-[0.8125rem]">
              ×{finding.occurrences}
              <span className="visually-hidden"> {finding.occurrences === 1 ? 'elemento afectado' : 'elementos afectados'}</span>
            </span>
          </span>
        </button>
      </h3>
      <div id={panelId} hidden={!expanded} className="space-y-4 pb-5 pl-[3.75rem] pr-4">
        <p className="max-w-[62ch] text-[0.9375rem] leading-relaxed text-text-muted">{finding.detail}</p>
        {finding.confidence !== null ? <p className="text-sm text-text-muted">Confianza del modelo: {Math.round(finding.confidence * 100)} %</p> : null}
        <ol className="space-y-6">
          {finding.nodes.map((node, index) => {
            const key = nodeKey(finding, index);
            return (
              <li key={key} className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <code className="min-w-0 break-all rounded-full bg-white/6 px-3 py-1 text-[0.75rem] text-azure-strong">{node.selector}</code>
                  {node.rect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(key)}
                      onFocus={() => onHover(key)}
                      onBlur={() => onHover(null)}
                      aria-pressed={activeKey === key}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/6 px-4 text-sm font-medium text-text transition-colors hover:bg-white/10 active:scale-[0.98] aria-pressed:bg-lens aria-pressed:text-on-cta"
                    >
                      Localizar en la captura
                    </button>
                  ) : null}
                </div>
                {node.note && node.note.length > 160 ? (
                  <details className="group/details text-sm leading-relaxed text-text-muted">
                    <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full font-medium text-text">
                      <IconChevron size={14} className="transition-transform duration-300 group-open/details:rotate-90" />
                      Diagnóstico completo de axe
                    </summary>
                    <p>{node.note}</p>
                  </details>
                ) : node.note ? (
                  <p className="text-sm leading-relaxed text-text-muted">{node.note}</p>
                ) : null}
                <Evidence evidence={node.evidence} />
                {node.fix ? (
                  <div className="space-y-2">
                    <p className="text-[0.9375rem] text-text">{node.fix.summary}</p>
                    <DiffView fix={node.fix} id={key} />
                  </div>
                ) : (
                  <pre tabIndex={0} role="region" aria-label="Fragmento HTML" className="focus-inset overflow-x-auto rounded-[1.25rem] bg-bg p-3 text-[0.75rem] text-text">
                    <code>{node.html}</code>
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
        {finding.occurrences > finding.nodes.length ? (
          <p className="text-sm text-text-muted">
            Se muestran {finding.nodes.length} de {finding.occurrences}. El JSON completo los cuenta todos.
          </p>
        ) : null}
        {finding.helpUrl ? (
          <a href={finding.helpUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full text-sm font-medium text-azure underline decoration-azure/40 hover:decoration-azure">
            Documentación de la regla <span className="visually-hidden">(se abre en otra pestaña)</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Evidence({ evidence }: { evidence: Finding['nodes'][number]['evidence'] }) {
  if (evidence.unfocused && evidence.focused) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Sin foco', evidence.unfocused],
          ['Con foco (Tab)', evidence.focused],
        ].map(([label, src]) => (
          <figure key={label} className="space-y-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- recorte generado por el motor, sin optimización posible */}
            <img src={src} alt={`Recorte del elemento: ${label?.toLowerCase()}`} loading="lazy" decoding="async" className="max-h-28 w-auto rounded-2xl" />
            <figcaption className="text-sm text-text-muted">{label}</figcaption>
          </figure>
        ))}
      </div>
    );
  }
  if (evidence.crop) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- recorte generado por el motor, sin optimización posible
      <img src={evidence.crop} alt="Recorte del elemento afectado tal y como se ve en la página" loading="lazy" decoding="async" className="max-h-32 w-auto rounded-2xl" />
    );
  }
  return null;
}

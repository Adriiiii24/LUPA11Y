/**
 * Estado de vista del informe: pestaña, filtros, ruta del teclado y qué se señala. Es el mismo en la
 * landing (muestra y auditoría en directo) y en un informe guardado (`/r/<id>`).
 *
 * Seleccionar y pasar por encima son dos cosas: la selección mueve la captura y la lupa; el paso del
 * puntero solo resalta. Lo activo es el paso si lo hay y, si no, la selección.
 */
import { SEVERITIES, type Finding, type Report, type Severity } from '@lupa11y/core/schema';
import { useMemo, useReducer } from 'react';
import { nodeKey } from './model.ts';

export type DockTab = 'console' | 'findings' | 'keyboard';

export interface ViewState {
  tab: DockTab;
  visible: ReadonlySet<Severity>;
  showPath: boolean;
  selected: string | null;
  hovered: string | null;
  /** Hallazgo que se pide abrir desde fuera (una burbuja); `at` distingue dos peticiones iguales. */
  openRequest: { id: string; at: number } | null;
}

export type ViewAction =
  | { type: 'tab'; tab: DockTab }
  | { type: 'toggle-severity'; severity: Severity }
  | { type: 'toggle-path' }
  | { type: 'select'; key: string | null }
  | { type: 'hover'; key: string | null }
  | { type: 'open-finding'; finding: Finding; at: number }
  | { type: 'run-started' }
  | { type: 'show-report'; report: Report };

const ALL: ReadonlySet<Severity> = new Set(SEVERITIES);

/** El primer nodo con caja de un informe: lo que se selecciona al abrirlo. */
export function firstKey(report: Report): string | null {
  for (const finding of report.findings) {
    const index = finding.nodes.findIndex((n) => n.rect);
    if (index !== -1) return nodeKey(finding, index);
  }
  return null;
}

export const initialView = (report: Report): ViewState => ({
  tab: 'findings',
  visible: ALL,
  showPath: true,
  selected: firstKey(report),
  hovered: null,
  openRequest: null,
});

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'tab':
      return { ...state, tab: action.tab };
    case 'toggle-severity': {
      const next = new Set(state.visible);
      // Siempre queda al menos una severidad visible.
      if (next.has(action.severity) && next.size > 1) next.delete(action.severity);
      else next.add(action.severity);
      return { ...state, visible: next };
    }
    case 'toggle-path':
      return { ...state, showPath: !state.showPath };
    case 'select':
      return { ...state, selected: action.key };
    case 'hover':
      return state.hovered === action.key ? state : { ...state, hovered: action.key };
    case 'open-finding': {
      const { finding } = action;
      const index = finding.nodes.findIndex((n) => n.rect);
      return {
        ...state,
        tab: 'findings',
        visible: state.visible.has(finding.severity) ? state.visible : new Set(state.visible).add(finding.severity),
        selected: index === -1 ? state.selected : nodeKey(finding, index),
        openRequest: { id: finding.id, at: action.at },
      };
    }
    case 'run-started':
      return { ...state, tab: 'console', selected: null, hovered: null };
    case 'show-report':
      return { ...state, tab: 'findings', visible: ALL, selected: firstKey(action.report), hovered: null };
  }
}

export interface ViewActions {
  setTab(tab: DockTab): void;
  toggleSeverity(severity: Severity): void;
  togglePath(): void;
  select(key: string | null): void;
  hover(key: string | null): void;
}

export function useReportView(report: Report) {
  const [view, dispatch] = useReducer(viewReducer, report, initialView);
  const actions = useMemo<ViewActions>(
    () => ({
      setTab: (tab) => dispatch({ type: 'tab', tab }),
      toggleSeverity: (severity) => dispatch({ type: 'toggle-severity', severity }),
      togglePath: () => dispatch({ type: 'toggle-path' }),
      select: (key) => dispatch({ type: 'select', key }),
      hover: (key) => dispatch({ type: 'hover', key }),
    }),
    [],
  );
  return { view, dispatch, actions, activeKey: view.hovered ?? view.selected };
}

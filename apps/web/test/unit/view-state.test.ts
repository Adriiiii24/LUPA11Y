import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeFinding, makeReport } from '../../../../packages/core/test/helpers/fixtures.ts';
import { findingIdOf, parseKey } from '../../components/observatory/model.ts';
import { firstKey, initialView, viewReducer } from '../../components/observatory/view-state.ts';

describe('claves de selección', () => {
  it('distingue nodos y paradas sin trocear cadenas a mano', () => {
    assert.deepEqual(parseKey('axe:color-contrast#2'), { kind: 'node', findingId: 'axe:color-contrast', index: 2 });
    assert.deepEqual(parseKey('stop:14'), { kind: 'stop', index: 14 });
    assert.equal(parseKey('sin-indice'), null);
    assert.equal(parseKey(null), null);
    assert.equal(findingIdOf('stop:3'), null);
    assert.equal(findingIdOf('keyboard:keyboard-trap#0'), 'keyboard:keyboard-trap');
  });
});

describe('estado de vista', () => {
  const withRect = makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }]);
  withRect.nodes[0]!.rect = { x: 0, y: 0, width: 10, height: 10 };
  const low = makeFinding('axe:landmark-one-main', 'low', [{ selector: 'html', html: '<html>' }]);
  const report = makeReport([withRect, low]);

  it('arranca con el primer nodo que tiene caja', () => {
    assert.equal(firstKey(report), 'axe:region#0');
    assert.equal(initialView(report).selected, 'axe:region#0');
  });

  it('siempre deja al menos una severidad visible', () => {
    let state = initialView(report);
    for (const severity of ['critical', 'high', 'medium'] as const) state = viewReducer(state, { type: 'toggle-severity', severity });
    state = viewReducer(state, { type: 'toggle-severity', severity: 'low' });
    assert.deepEqual([...state.visible], ['low']);
  });

  it('abrir un hallazgo desde una burbuja lo hace visible, lo selecciona y cambia de pestaña', () => {
    let state = viewReducer(initialView(report), { type: 'toggle-severity', severity: 'medium' });
    state = viewReducer(state, { type: 'tab', tab: 'keyboard' });
    state = viewReducer(state, { type: 'open-finding', finding: withRect, at: 7 });
    assert.equal(state.tab, 'findings');
    assert.ok(state.visible.has('medium'));
    assert.equal(state.selected, 'axe:region#0');
    assert.deepEqual(state.openRequest, { id: 'axe:region', at: 7 });
  });

  it('al auditar se va al registro y al terminar vuelve a los hallazgos con todo visible', () => {
    let state = viewReducer(initialView(report), { type: 'toggle-severity', severity: 'low' });
    state = viewReducer(state, { type: 'run-started' });
    assert.deepEqual([state.tab, state.selected], ['console', null]);
    state = viewReducer(state, { type: 'show-report', report });
    assert.deepEqual([state.tab, state.selected, state.visible.size], ['findings', 'axe:region#0', 4]);
  });
});

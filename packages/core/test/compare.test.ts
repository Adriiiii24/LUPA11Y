import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareBatches, compareReports, nodeFingerprint, normalizeTag, regressions, samePage } from '../src/compare.ts';
import { comparisonToMarkdown } from '../src/format.ts';
import { makeFinding, makeReport } from './helpers/fixtures.ts';

const add = (n: number) => ({ selector: `article:nth-of-type(${n}) > div.add`, html: '<div class="add" role="button" tabindex="0">Añadir</div>' });

describe('huellas', () => {
  it('ignoran los atributos que cambian al arreglar y el orden de los atributos', () => {
    assert.equal(normalizeTag('<a class="x" href="/a" aria-label="Uno">Uno</a>'), normalizeTag('<A href="/a" style="color:red">Otro</A>'));
    assert.notEqual(normalizeTag('<a href="/a">'), normalizeTag('<a href="/b">'));
  });

  it('no dependen de la posición entre hermanos', () => {
    const f = makeFinding('keyboard:keyboard-inoperable', 'high', [add(1)]);
    assert.equal(nodeFingerprint(f, add(1)), nodeFingerprint(f, add(7)));
    assert.match(nodeFingerprint(f, add(1)), /^[0-9a-f]{14}$/);
  });
});

describe('compareReports', () => {
  it('separa lo nuevo, lo resuelto, lo que cambia y lo que sigue igual', () => {
    const before = makeReport([
      makeFinding('axe:image-alt', 'critical', [{ selector: 'img.hero', html: '<img src="/hero.jpg">' }]),
      makeFinding('keyboard:keyboard-inoperable', 'high', [add(1), add(2), add(3)]),
      makeFinding('axe:region', 'medium', [{ selector: 'strong', html: '<strong>' }]),
    ]);
    const after = makeReport([
      makeFinding('keyboard:keyboard-inoperable', 'high', [add(1), add(2)]),
      makeFinding('axe:region', 'medium', [{ selector: 'strong', html: '<strong>' }]),
      makeFinding('axe:color-contrast', 'high', [{ selector: '.notes', html: '<p class="notes">' }]),
    ]);
    const result = compareReports(before, after);
    assert.deepEqual(result.added.map((f) => f.id), ['axe:color-contrast']);
    assert.deepEqual(result.resolved.map((f) => f.id), ['axe:image-alt']);
    assert.deepEqual(result.unchanged.map((f) => f.id), ['axe:region']);
    const [changed] = result.changed;
    assert.equal(changed?.finding.id, 'keyboard:keyboard-inoperable');
    assert.equal(changed?.resolvedNodes.length, 1);
    assert.equal(changed?.newNodes.length, 0);
    assert.deepEqual(regressions(result, 'high').map((f) => f.id), ['axe:color-contrast']);
    assert.deepEqual(regressions(result, 'critical'), []);
  });

  it('empareja un nodo aunque un hermano nuevo cambie su :nth-of-type', () => {
    const before = makeReport([makeFinding('axe:link-name', 'high', [{ selector: 'nav > a:nth-of-type(2)', html: '<a href="/carrito">' }])]);
    const after = makeReport([makeFinding('axe:link-name', 'high', [{ selector: 'nav > a:nth-of-type(3)', html: '<a href="/carrito">' }])]);
    assert.deepEqual(compareReports(before, after).unchanged.map((f) => f.id), ['axe:link-name']);
  });

  it('no compara las fases que no se completaron en las dos auditorías', () => {
    const before = makeReport([makeFinding('layout:reflow', 'high', [{ selector: 'header', html: '<header>' }])]);
    before.phases = before.phases.map((p) => (p.id === 'vision' ? { ...p, status: 'skipped' } : p));
    const after = makeReport([makeFinding('vision:alt-mismatch', 'high', [{ selector: 'img', html: '<img src="/a.jpg">' }])]);
    after.phases = after.phases.map((p) => (p.id === 'layout' ? { ...p, status: 'skipped' } : p));
    const result = compareReports(before, after);
    assert.deepEqual(result.added, [], 'la visión no corrió en la línea base: no es nuevo');
    assert.deepEqual(result.resolved, [], 'el reflujo no se midió ahora: no está resuelto');
    assert.deepEqual(result.incomparable.map((f) => f.id), ['vision:alt-mismatch']);
    assert.deepEqual(regressions(result, 'low'), []);
    assert.match(comparisonToMarkdown(result), /1 hallazgos de fases que no se completaron/);
  });

  it('cuenta como regresión una regla que gana apariciones', () => {
    const before = makeReport([makeFinding('axe:color-contrast', 'high', [{ selector: '.a', html: '<p class="a">' }], 4)]);
    const after = makeReport([makeFinding('axe:color-contrast', 'high', [{ selector: '.a', html: '<p class="a">' }], 9)]);
    assert.deepEqual(regressions(compareReports(before, after), 'medium').map((f) => f.id), ['axe:color-contrast']);
    assert.match(comparisonToMarkdown(compareReports(before, after)), /4 → 9 nodos/);
  });
});

describe('compareBatches', () => {
  it('empareja por URL e ignora la barra final y el fragmento', () => {
    const a = makeReport([makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }])], 'https://tienda.example/carrito/');
    const b = makeReport([makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }])], 'https://tienda.example/carrito#arriba');
    const nueva = makeReport([makeFinding('axe:region', 'medium', [{ selector: 'main', html: '<main>' }])], 'https://tienda.example/pago');
    assert.ok(samePage(a, b));
    const [first, second] = compareBatches([a], [b, nueva]);
    assert.equal(first?.baseline, a);
    assert.equal(first?.comparison.unchanged.length, 1);
    assert.equal(second?.baseline, null);
    assert.equal(second?.comparison.added.length, 1);
  });
});

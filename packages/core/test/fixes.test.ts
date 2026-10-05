import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { adjustForContrast, contrastRatio, parseHex, parseRatio, toHex } from '../src/fixes/color.ts';
import { unifiedDiff } from '../src/fixes/diff.ts';
import { openingTagName, setAttribute, toNativeButton } from '../src/fixes/html.ts';

const hex = (value: string) => {
  const rgb = parseHex(value);
  assert.ok(rgb, `color inválido ${value}`);
  return rgb;
};

describe('color', () => {
  it('lee hex de 3, 6 y 8 dígitos', () => {
    assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
    assert.deepEqual(parseHex('7a2e12'), { r: 122, g: 46, b: 18 });
    assert.deepEqual(parseHex('#00000080'), { r: 0, g: 0, b: 0 });
    assert.equal(parseHex('rgb(0,0,0)'), null);
  });

  it('calcula el contraste WCAG con los valores de referencia', () => {
    assert.equal(contrastRatio(hex('#000'), hex('#fff')).toFixed(2), '21.00');
    assert.equal(contrastRatio(hex('#777777'), hex('#ffffff')).toFixed(2), '4.48');
  });

  it('corrige el color hasta el objetivo sin cambiar de tono', () => {
    const fg = hex('#b3a898');
    const bg = hex('#fffdf9');
    const fixed = adjustForContrast(fg, bg, 4.5);
    assert.ok(fixed);
    assert.ok(contrastRatio(fixed, bg) >= 4.5, `ratio ${contrastRatio(fixed, bg)}`);
    assert.ok(contrastRatio(fixed, bg) < 5, 'el ajuste debe ser el mínimo, no saltar a negro');
    // Sigue siendo un marrón cálido: rojo > verde > azul, como el original.
    assert.ok(fixed.r > fixed.g && fixed.g > fixed.b, `tono perdido: ${toHex(fixed)}`);
  });

  it('aclara sobre fondo oscuro y no toca lo que ya cumple', () => {
    const bg = hex('#12141d');
    const fixed = adjustForContrast(hex('#3a4a8a'), bg, 7);
    assert.ok(fixed && contrastRatio(fixed, bg) >= 7);
    const ok = hex('#ffffff');
    assert.equal(adjustForContrast(ok, bg, 7), ok);
  });

  it('interpreta ratios de axe', () => {
    assert.equal(parseRatio('4.5:1'), 4.5);
    assert.equal(parseRatio(7), 7);
    assert.equal(parseRatio('n/a'), null);
  });
});

describe('diff unificado', () => {
  it('marca solo las líneas que cambian', () => {
    const diff = unifiedDiff('a {\n  color: #999;\n}', 'a {\n  color: #6b6b6b;\n}', 'styles.css');
    assert.equal(diff, ['--- a/styles.css', '+++ b/styles.css', '@@ -1,3 +1,3 @@', ' a {', '-  color: #999;', '+  color: #6b6b6b;', ' }'].join('\n'));
  });

  it('representa una adición pura', () => {
    assert.match(unifiedDiff('', 'x', 'f'), /@@ -0,0 \+1,1 @@\n\+x$/);
  });
});

describe('html', () => {
  it('añade, sustituye y escapa atributos', () => {
    assert.equal(setAttribute('<img src="a.jpg">', 'alt', 'Taza "roja"'), '<img src="a.jpg" alt="Taza &quot;roja&quot;">');
    assert.equal(setAttribute('<img alt="IMG_01.jpg" src="a.jpg">', 'alt', ''), '<img alt="" src="a.jpg">');
    assert.equal(setAttribute('<img src="a.jpg" />', 'alt', 'x'), '<img src="a.jpg" alt="x" />');
    assert.equal(setAttribute('<img data-alt="z" src="a">', 'alt', '$1'), '<img data-alt="z" src="a" alt="$1">');
    assert.equal(setAttribute('texto', 'alt', 'x'), 'texto');
  });

  it('convierte un botón simulado en <button> nativo', () => {
    assert.equal(
      toNativeButton('<div class="add" role="button" tabindex="0">Añadir</div>'),
      '<button type="button" class="add">Añadir</button>',
    );
    assert.equal(toNativeButton('<div role="button">Sin cierre'), null);
    assert.equal(toNativeButton('<button>Ya lo es</button>'), null);
  });

  it('lee el nombre de la etiqueta de apertura', () => {
    assert.equal(openingTagName('  <A href="#">x</A>'), 'a');
    assert.equal(openingTagName('sin etiqueta'), null);
  });
});

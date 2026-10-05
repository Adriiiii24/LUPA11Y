import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { channels, PALETTE, tint, type PaletteColor } from '../../components/palette.ts';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const variable = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})\\s*;`, 'i').exec(css)?.[1]?.toLowerCase();
const kebab = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

describe('paleta', () => {
  it('coincide con las variables de globals.css que usan las clases de Tailwind', () => {
    const shared = Object.keys(PALETTE).filter((name) => variable(kebab(name)) !== undefined);
    assert.ok(shared.length >= 15, `solo ${shared.length} colores compartidos`);
    for (const name of shared) assert.equal(PALETTE[name as PaletteColor], variable(kebab(name)), `--${kebab(name)}`);
  });

  it('los canales para transparencias son los mismos colores', () => {
    const rgbVariables = [...css.matchAll(/--([a-z-]+)-rgb:\s*(\d+ \d+ \d+);/g)];
    assert.ok(rgbVariables.length >= 9);
    for (const [, name, value] of rgbVariables) {
      const color = name!.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()) as PaletteColor;
      assert.ok(color in PALETTE, `--${name}-rgb no tiene color en la paleta`);
      assert.equal(channels(color), value, `--${name}-rgb`);
    }
  });

  it('escribe los tintes igual que a mano', () => {
    assert.equal(channels('azure'), '86 194 242');
    assert.equal(tint('iris', 0.17), 'rgb(107 227 90 / 0.17)');
  });
});

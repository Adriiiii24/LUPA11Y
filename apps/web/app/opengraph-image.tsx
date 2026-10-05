/**
 * La tarjeta al compartir el enlace: el mismo mundo que la web (zinc profundo, dos lentes azul y verde
 * que se cruzan, la marca) y lo que hace LupA11y en una línea. Se genera una vez en el build.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { PALETTE, rgba } from '@/components/palette';

export const alt = 'LupA11y: auditoría de accesibilidad que pulsa Tab, mide el foco píxel a píxel y te da cada arreglo en código.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const mark = await readFile(join(process.cwd(), 'components/brand/lupa11y-mark.png'));
  return new ImageResponse(
    (
      <div style={{ position: 'relative', display: 'flex', width: '100%', height: '100%', background: PALETTE.bg, color: PALETTE.text, overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            left: 640,
            top: 40,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: `radial-gradient(circle at 38% 30%, ${rgba('azure', 0.34)}, ${rgba('azureShade', 0.14)} 50%, ${rgba('azureShade', 0.04)} 72%)`,
            boxShadow: `inset 0 0 0 2px ${rgba('azure', 0.28)}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 820,
            top: 190,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: `radial-gradient(circle at 40% 32%, ${rgba('iris', 0.3)}, ${rgba('irisShade', 0.12)} 52%, ${rgba('irisShade', 0.03)} 74%)`,
            boxShadow: `inset 0 0 0 2px ${rgba('iris', 0.26)}`,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px', width: 820 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no usa next/image */}
            <img src={`data:image/png;base64,${mark.toString('base64')}`} width={72} height={72} alt="" />
            <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>LupA11y</span>
          </div>
          <div style={{ marginTop: 44, fontSize: 68, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2 }}>Auditoría de accesibilidad</div>
          <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2, color: PALETTE.textMuted }}>
            que pulsa&nbsp;<span style={{ color: PALETTE.irisStrong }}>Tab.</span>
          </div>
          <div style={{ marginTop: 36, fontSize: 28, lineHeight: 1.35, color: PALETTE.textMuted }}>
            axe-core, reflujo a 320 px, un agente de teclado y Gemini Vision. Cada hallazgo con su arreglo en código.
          </div>
        </div>
      </div>
    ),
    size,
  );
}

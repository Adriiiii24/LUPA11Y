// Capturas de revisión de la landing: escritorio (1440) y móvil (390). La web solo tiene tema oscuro.
// Las páginas completas se toman con movimiento reducido (estado final, sin depender del scroll);
// los pliegues, con movimiento normal y la coreografía del hero ya asentada.
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:3000/';
const out = new URL('./review/', import.meta.url);
const browser = await chromium.launch();

const shots = [
  { name: 'desktop', width: 1440, height: 900, scheme: 'dark' },
  { name: 'mobile', width: 390, height: 844, scheme: 'dark', mobile: true },
];

for (const shot of shots) {
  for (const motion of ['reduce', 'no-preference']) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: shot.mobile ? 2 : 1,
      isMobile: !!shot.mobile,
      hasTouch: !!shot.mobile,
      colorScheme: shot.scheme,
      reducedMotion: motion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(motion === 'reduce' ? 800 : 4200);
    if (motion === 'reduce') {
      await page.screenshot({ path: new URL(`${shot.name}.png`, out).pathname.slice(1), fullPage: true });
    } else {
      await page.screenshot({ path: new URL(`${shot.name}-fold.png`, out).pathname.slice(1) });
    }
    if (errors.length) console.log(shot.name, motion, 'ERRORS:', errors.slice(0, 5));
    await context.close();
  }
}
await browser.close();
console.log('ok');

// Estados interactivos: lupa sobre la captura, foco de teclado y burbuja seleccionada.
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 300)));
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
// foco de teclado en el iris
await page.locator('#audit-url').focus();
await page.waitForTimeout(600);
await page.screenshot({ path: 'review/desktop-focus.png', clip: { x: 0, y: 300, width: 900, height: 420 } });
// burbuja → informe
await page.getByRole('button', { name: /^3\. Crítica/ }).click();
await page.waitForTimeout(1600);
// El ratón fuera de la captura: la lupa se acopla sola al elemento seleccionado.
await page.mouse.move(1400, 880);
await page.waitForTimeout(1800);
await page.screenshot({ path: 'review/desktop-report.png' });
console.log(errors.length ? errors : 'no console errors');
await browser.close();

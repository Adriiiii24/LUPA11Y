/**
 * Casos límite de las fases contra páginas mínimas: un autofocus no puede recortar el recorrido del
 * teclado, y el texto que solo se ve (aria-hidden) recortado por el espaciado queda como revisión.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { audit } from '../src/index.ts';

const page = (body: string) => `<!doctype html><html lang="es"><head><title>Caso</title></head><body>${body}</body></html>`;

const PAGES: Record<string, string> = {
  '/autofoco-al-final.html': page('<button>Uno</button><button>Dos</button><button>Tres</button><textarea autofocus aria-label="Mensaje"></textarea>'),
  '/autofoco-en-medio.html': page(
    '<button>Uno</button><textarea autofocus aria-label="Mensaje"></textarea><button>Dos</button><button tabindex="1">Primero</button>',
  ),
  // La palabra gigante decorativa llena el pie a medida; con el espaciado de WCAG crece y el pie la corta.
  '/pie-decorativo.html': page(`
    <footer style="overflow: hidden">
      <p aria-hidden="true" style="margin: 0; font: 700 120px/1 sans-serif; width: max-content">LUPA</p>
      <nav><a href="#privacidad">Privacidad</a> <a href="#condiciones">Condiciones</a></nav>
    </footer>
    <script>
      const footer = document.querySelector('footer');
      footer.style.width = footer.querySelector('p').offsetWidth + 'px';
    </script>`),
};

describe('casos límite de las fases', () => {
  let server: Server;
  let origin = '';

  before(async () => {
    server = createServer((request, response) => {
      const body = PAGES[request.url ?? ''];
      response.writeHead(body ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
      response.end(body ?? '');
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(() => new Promise<void>((done) => server.close(() => done())));

  const stopsOf = async (path: string) => {
    const report = await audit(`${origin}${path}`, { vision: false, layout: false });
    return { outcome: report.keyboard?.outcome, names: report.keyboard?.stops.map((s) => s.name) };
  };

  it('con un campo con autofocus al final, el teclado recorre toda la página desde el principio', async () => {
    assert.deepEqual(await stopsOf('/autofoco-al-final.html'), { outcome: 'closed', names: ['Uno', 'Dos', 'Tres', 'Mensaje'] });
  });

  it('con el autofocus a mitad, empieza por el primero del orden de tabulación, tabindex positivo incluido', async () => {
    assert.deepEqual(await stopsOf('/autofoco-en-medio.html'), { outcome: 'closed', names: ['Primero', 'Uno', 'Mensaje', 'Dos'] });
  });

  it('el texto decorativo con aria-hidden que se recorta queda pendiente de revisión, no como fallo', async () => {
    const report = await audit(`${origin}/pie-decorativo.html`, { vision: false, keyboard: false });
    assert.equal(report.findings.find((f) => f.id === 'layout:text-spacing'), undefined);
    const review = report.findings.find((f) => f.id === 'layout:text-spacing-hidden');
    assert.equal(review?.severity, 'low');
    assert.deepEqual(
      review?.nodes.map((n) => n.selector),
      ['footer'],
    );
    // La nota cita lo que se corta, no todo el texto del pie.
    assert.match(review?.nodes[0]?.note ?? '', /^«LUPA»: se dejan de ver \d+ px a lo ancho\.$/);
  });
});

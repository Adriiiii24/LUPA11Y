import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSitemap, sitemapUrls } from '../src/sitemap.ts';

const urlset = (...locs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs.map((l) => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;

describe('sitemap', () => {
  it('lee las URL y decodifica entidades y CDATA', () => {
    const parsed = parseSitemap(urlset('https://t.example/a?x=1&amp;y=2', '<![CDATA[https://t.example/b]]>', ' https://t.example/caf&#233; '));
    assert.equal(parsed.index, false);
    assert.deepEqual(parsed.locations, ['https://t.example/a?x=1&y=2', 'https://t.example/b', 'https://t.example/café']);
  });

  it('sigue un índice de sitemaps, quita duplicados y respeta el máximo', async () => {
    const files: Record<string, string> = {
      'https://t.example/sitemap.xml': '<sitemapindex><sitemap><loc>https://t.example/s1.xml</loc></sitemap><sitemap><loc>https://t.example/s2.xml</loc></sitemap></sitemapindex>',
      'https://t.example/s1.xml': urlset('https://t.example/', 'https://t.example/carrito'),
      'https://t.example/s2.xml': urlset('https://t.example/carrito', 'https://t.example/pago', 'https://t.example/ayuda'),
    };
    const fake = (async (input: string | URL | Request) => {
      const body = files[String(input)];
      return new Response(body ?? '', { status: body ? 200 : 404 });
    }) as typeof fetch;
    assert.deepEqual(await sitemapUrls('https://t.example/sitemap.xml', 3, fake), ['https://t.example/', 'https://t.example/carrito', 'https://t.example/pago']);
    await assert.rejects(sitemapUrls('https://t.example/no.xml', 3, fake), /respondió 404/);
  });
});

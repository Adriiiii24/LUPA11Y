/**
 * Lectura de sitemaps (protocolo sitemaps.org): las URL de `<loc>`, siguiendo un nivel de
 * índice de sitemaps. Sin parser XML: el formato es plano y solo interesan las etiquetas `<loc>`.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decode = (text: string) =>
  text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return ENTITIES[entity.toLowerCase()] ?? whole;
    })
    .trim();

export interface ParsedSitemap {
  /** true si es un índice: sus `<loc>` son otros sitemaps. */
  index: boolean;
  locations: string[];
}

export function parseSitemap(xml: string): ParsedSitemap {
  const index = /<sitemapindex[\s>]/i.test(xml);
  const locations = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decode(match[1] ?? '')).filter(Boolean);
  return { index, locations };
}

/** Descarga un sitemap (o un índice y sus primeros sitemaps) y devuelve hasta `max` URL de página. */
export async function sitemapUrls(url: string, max: number, fetcher: typeof fetch = fetch): Promise<string[]> {
  const read = async (target: string) => {
    const response = await fetcher(target, { headers: { accept: 'application/xml, text/xml;q=0.9, */*;q=0.1' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`El sitemap ${target} respondió ${response.status}.`);
    return parseSitemap(await response.text());
  };
  const root = await read(url);
  const pages: string[] = [];
  if (root.index) {
    for (const child of root.locations.slice(0, 5)) {
      if (pages.length >= max) break;
      pages.push(...(await read(child)).locations);
    }
  } else {
    pages.push(...root.locations);
  }
  return [...new Set(pages)].slice(0, max);
}

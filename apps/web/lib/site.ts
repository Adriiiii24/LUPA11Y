/** Origen público del sitio (`LUPA11Y_SITE_URL`): base de los metadatos, el sitemap y las tarjetas al compartir. */
export function siteUrl(): URL {
  try {
    return new URL(process.env['LUPA11Y_SITE_URL'] || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

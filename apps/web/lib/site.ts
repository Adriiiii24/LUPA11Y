/**
 * Origen público del sitio: base de los metadatos, el sitemap, las tarjetas al compartir y la URL de
 * la muestra. Manda `LUPA11Y_SITE_URL`; en Vercel, si falta, el dominio de producción del proyecto.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const vercel = env['VERCEL_PROJECT_PRODUCTION_URL'];
  try {
    return new URL(env['LUPA11Y_SITE_URL'] || (vercel ? `https://${vercel}` : 'http://localhost:3000'));
  } catch {
    return new URL('http://localhost:3000');
  }
}

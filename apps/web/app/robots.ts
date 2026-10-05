import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** La demo rota a propósito, la API y los informes compartidos no se indexan. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/demo', '/api/', '/r/', '/sample/'] },
    sitemap: new URL('/sitemap.xml', siteUrl()).href,
  };
}

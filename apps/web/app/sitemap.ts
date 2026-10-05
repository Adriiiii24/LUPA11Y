import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** Solo la landing: la demo rota a propósito queda fuera, como promete PRODUCT.md. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl().href, changeFrequency: 'monthly', priority: 1 }];
}

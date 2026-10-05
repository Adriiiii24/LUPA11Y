/**
 * GET /sample/<clave>: las imágenes de la auditoría de muestra, generadas como estáticos en el build.
 * La landing ya no las lleva dentro del HTML: el navegador las pide cuando las va a pintar.
 */
import { imageResponse } from '@/lib/server/report-images';
import { sampleImages } from '@/lib/server/sample';

export const dynamicParams = false;

export function generateStaticParams() {
  return [...sampleImages().keys()].map((key) => ({ key }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return imageResponse(sampleImages().get(key));
}

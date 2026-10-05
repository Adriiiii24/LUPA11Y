/** GET /r/<id>/img/<clave>: las imágenes de un informe guardado. */
import { imageIndex, imageResponse, KEY_PATTERN } from '@/lib/server/report-images';
import { reportStore } from '@/lib/server/report-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; key: string }> }) {
  const { id, key } = await params;
  if (!KEY_PATTERN.test(key)) return imageResponse(undefined);
  const report = await reportStore()?.load(id);
  return imageResponse(report ? imageIndex(report).get(key) : undefined);
}

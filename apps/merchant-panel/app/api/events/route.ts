import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/api';

// Pasarela SSE: reenvía los avisos en tiempo real del comercio con el token de la sesión (cookie
// httpOnly), que el navegador no puede leer.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return new Response(null, { status: 401 });
  const upstream = await fetch(
    `${process.env.API_BASE_URL ?? 'http://localhost:4000'}/v1/merchant/events`,
    {
      signal: request.signal,
      cache: 'no-store',
      headers: { accept: 'text/event-stream', authorization: `Bearer ${token}` },
    },
  ).catch(() => null);
  if (!upstream?.ok || !upstream.body)
    return new Response(null, { status: upstream?.status ?? 502 });
  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}

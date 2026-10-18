// Pasarela SSE: el navegador del comensal nunca habla con la API (ADR-021), así que la web QR
// reenvía el flujo de eventos de la mesa.
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/t/[code]/events'>) {
  const { code } = await params;
  const upstream = await fetch(
    `${process.env.API_BASE_URL ?? 'http://localhost:4000'}/v1/qr/${encodeURIComponent(code)}/events`,
    { signal: request.signal, cache: 'no-store', headers: { accept: 'text/event-stream' } },
  ).catch(() => null);
  if (!upstream?.ok || !upstream.body) return new Response(null, { status: 502 });
  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}

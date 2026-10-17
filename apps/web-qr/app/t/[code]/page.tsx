import type { ProblemDetails, QrResolution } from '@comercechat/shared-types';
import { headers } from 'next/headers';

const apiBase = () => process.env.API_BASE_URL ?? 'http://localhost:4000';

type Result = { ok: true; qr: QrResolution } | { ok: false; problem: ProblemDetails | null };

async function resolveQr(code: string): Promise<Result> {
  try {
    const res = await fetch(`${apiBase()}/v1/qr/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
    const body: unknown = await res.json();
    return res.ok
      ? { ok: true, qr: body as QrResolution }
      : { ok: false, problem: body as ProblemDetails };
  } catch {
    return { ok: false, problem: null };
  }
}

export default async function QrPage({ params }: PageProps<'/t/[code]'>) {
  const { code } = await params;
  const result = await resolveQr(code);

  if (!result.ok) {
    // Página de error segura: nunca muestra datos del comercio (FR-QR-01).
    const unavailable = result.problem?.code === 'MERCHANT_UNAVAILABLE';
    return (
      <main className="error-box">
        <h1>
          {unavailable
            ? 'Este comercio no acepta pagos por QR ahora'
            : 'Este código QR no es válido'}
        </h1>
        <p>
          {result.problem
            ? 'Pide la cuenta al personal del local.'
            : 'No hemos podido conectar. Inténtalo de nuevo en unos segundos.'}
        </p>
      </main>
    );
  }

  const { qr } = result;
  const host = (await headers()).get('host');
  return (
    <main>
      <header className="identity">
        <div className="logo" aria-hidden="true">
          {qr.merchant.brandName.charAt(0)}
        </div>
        <div>
          <h1>{qr.merchant.brandName}</h1>
          <p>{qr.location.address}</p>
          {qr.table && <span className="table-label">{qr.table.label}</span>}
        </div>
      </header>
      <p className="domain-hint">
        Comprueba que la dirección empieza por <strong>{host}</strong> antes de pagar.
      </p>
      <section className="next" aria-live="polite">
        <p>Aquí verás la cuenta de la mesa, podrás dividirla, dejar propina y pagar.</p>
        <p>(Llega en el hito P2 de la PoC.)</p>
      </section>
    </main>
  );
}

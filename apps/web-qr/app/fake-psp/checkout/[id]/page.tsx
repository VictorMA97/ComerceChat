import type { FakeCheckoutSession } from '@comercechat/shared-types';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { completeCheckout } from './actions';

export const metadata = { title: 'PSP simulado · ComerceChat' };

/**
 * Página de pago del PSP simulado (ARCHITECTURE §16.3). En el MVP la sustituye la del PSP real.
 * Cada botón es un formulario nativo: funciona aunque el JavaScript no haya cargado.
 */
export default async function FakeCheckoutPage({
  params,
  searchParams,
}: PageProps<'/fake-psp/checkout/[id]'>) {
  const { id } = await params;
  const { step, error } = await searchParams;
  let session: FakeCheckoutSession;
  try {
    session = await api<FakeCheckoutSession>(`/fake-psp/sessions/${encodeURIComponent(id)}`);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return (
      <main className="error-box">
        <h1>Sesión de pago no encontrada</h1>
      </main>
    );
  }
  const finish = (outcome: 'succeed' | 'decline' | 'fail_3ds') =>
    completeCheckout.bind(null, session.id, outcome);

  return (
    <main className="psp">
      <p className="psp-banner">PSP SIMULADO · no se mueve dinero real</p>
      <section className="card">
        <p className="muted">Pago a</p>
        <h1>{session.merchantName}</h1>
        <p className="psp-amount">{formatCents(session.amountCents)}</p>
        <p className="muted">
          En tu extracto aparecerá como <strong>{session.statementDescriptor}</strong>
        </p>
        {session.status !== 'OPEN' ? (
          <>
            <p className="error">Esta sesión de pago ya no está disponible ({session.status}).</p>
            <a className="psp-link" href={session.returnUrl}>
              Volver
            </a>
          </>
        ) : step === '3ds' ? (
          <div className="psp-actions">
            <p>Tu banco te pide confirmar el pago (simulación de 3DS).</p>
            <form action={finish('succeed')}>
              <button className="pay-button" type="submit">
                Aprobar en la app del banco
              </button>
            </form>
            <form action={finish('fail_3ds')}>
              <button className="psp-secondary" type="submit">
                Fallar la verificación
              </button>
            </form>
          </div>
        ) : (
          <div className="psp-actions">
            <p className="psp-card">Tarjeta de prueba •••• 4242</p>
            <form action={finish('succeed')}>
              <button className="pay-button" type="submit">
                Pagar
              </button>
            </form>
            <Link
              className="psp-secondary as-button"
              href={`/fake-psp/checkout/${session.id}?step=3ds`}
            >
              Pagar con verificación 3DS
            </Link>
            <form action={finish('decline')}>
              <button className="psp-secondary" type="submit">
                Simular tarjeta rechazada
              </button>
            </form>
            <a className="psp-link" href={session.returnUrl}>
              Abandonar el pago
            </a>
          </div>
        )}
        {typeof error === 'string' && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}

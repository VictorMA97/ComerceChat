import type { TableBill } from '@comercechat/shared-types';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { MerchantHeader } from '@/components/merchant-header';
import { api, ApiError } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { PayForm } from './pay-form';

const ERROR_TITLES: Record<string, string> = {
  QR_INVALID: 'Este código QR no es válido',
  MERCHANT_UNAVAILABLE: 'Este comercio no acepta pagos por QR ahora',
};

export default async function TablePage({ params }: PageProps<'/t/[code]'>) {
  const { code } = await params;
  let data: TableBill;
  try {
    data = await api<TableBill>(`/qr/${encodeURIComponent(code)}/bill`);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    // Página de error segura: nunca muestra datos del comercio (FR-QR-01).
    return (
      <main className="error-box">
        <h1>{ERROR_TITLES[err.problem.code] ?? 'No podemos mostrar la cuenta'}</h1>
        <p>
          {ERROR_TITLES[err.problem.code]
            ? 'Pide la cuenta al personal del local.'
            : err.problem.title}
        </p>
      </main>
    );
  }

  const host = (await headers()).get('host');
  const { bill } = data;
  return (
    <main>
      <MerchantHeader qr={data.qr} host={host} />

      {!bill ? (
        <section className="card empty">
          <h2>No hay ninguna cuenta abierta</h2>
          <p>Cuando el personal abra la cuenta de esta mesa podrás verla y pagarla aquí.</p>
        </section>
      ) : (
        <>
          <section className="card" aria-labelledby="bill-title">
            <h2 id="bill-title">Tu cuenta</h2>
            <ul className="lines">
              {bill.lines.map((l, i) => (
                <li key={i}>
                  <span className="qty">{l.qty}×</span>
                  <span className="name">{l.name}</span>
                  <span className="price">{formatCents(l.totalCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="totals">
              <div>
                <dt>Total</dt>
                <dd>{formatCents(bill.totalCents)}</dd>
              </div>
              {bill.paidCents > 0 && (
                <div>
                  <dt>Ya pagado</dt>
                  <dd>−{formatCents(bill.paidCents)}</dd>
                </div>
              )}
            </dl>
          </section>

          {bill.pendingCents > 0 ? (
            <section className="card">
              <PayForm
                qrCode={code}
                pendingCents={bill.pendingCents}
                tips={data.tips}
                guestMaxPaymentCents={data.guestMaxPaymentCents}
                idempotencyBase={randomUUID()}
              />
            </section>
          ) : (
            <section className="card empty">
              <h2>Cuenta pagada</h2>
              <p>¡Gracias! No queda nada pendiente en esta mesa.</p>
            </section>
          )}
        </>
      )}
    </main>
  );
}

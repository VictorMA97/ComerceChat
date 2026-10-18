import type { CouponView, TableBill } from '@comercechat/shared-types';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { AccountLink } from '@/components/account-link';
import { MerchantHeader } from '@/components/merchant-header';
import { apiAsUser, userToken } from '@/lib/user';
import { api, ApiError } from '@/lib/api';
import { LiveRefresh } from '@/lib/live-refresh';
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
        {err.problem.code === 'POS_UNAVAILABLE' && <LiveRefresh src={`/t/${code}/events`} />}
      </main>
    );
  }

  const host = (await headers()).get('host');
  const { bill } = data;
  // Cupones del comensal identificado en este comercio; si falla, se paga sin cupón.
  const coupons = (await userToken())
    ? await apiAsUser<CouponView[]>(`/me/coupons?merchantId=${data.qr.merchant.id}`).catch(() => [])
    : [];
  return (
    <main>
      <LiveRefresh src={`/t/${code}/events`} />
      <MerchantHeader qr={data.qr} host={host} />
      <AccountLink />

      {!bill ? (
        <section className="card empty">
          <h2>No hay ninguna cuenta abierta</h2>
          <p>Cuando el personal abra la cuenta de esta mesa podrás verla y pagarla aquí.</p>
        </section>
      ) : (
        <>
          <section className="card" aria-labelledby="bill-title">
            <h2 id="bill-title">Cuenta de la mesa</h2>
            <ul className="lines">
              {bill.lines.map((l) => (
                <li key={l.lineId} className={l.paidUnits >= l.qty ? 'paid' : undefined}>
                  <span className="qty">{l.qty}×</span>
                  <span className="name">
                    {l.name}
                    {l.paidUnits > 0 && (
                      <small className="tag tag-paid">
                        {l.paidUnits === l.qty ? 'pagado' : `${l.paidUnits} pagado`}
                      </small>
                    )}
                    {l.reservedUnits > 0 && <small className="tag tag-paying">pagando</small>}
                  </span>
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
              {bill.reservedCents > 0 && (
                <div className="paying">
                  <dt>Pagando ahora otros comensales</dt>
                  <dd>−{formatCents(bill.reservedCents)}</dd>
                </div>
              )}
              <div className="grand">
                <dt>Queda por pagar</dt>
                <dd>{formatCents(bill.availableCents)}</dd>
              </div>
            </dl>
          </section>

          {bill.availableCents > 0 ? (
            <section className="card">
              <PayForm
                target={{ qrCode: code }}
                bill={bill}
                tips={data.tips}
                guestMaxPaymentCents={data.guestMaxPaymentCents}
                idempotencyBase={randomUUID()}
                coupons={coupons}
              />
            </section>
          ) : bill.reservedCents > 0 ? (
            <section className="card empty" aria-live="polite">
              <h2>Otro comensal está pagando lo que queda</h2>
              <p>Esta página se actualizará sola cuando termine.</p>
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

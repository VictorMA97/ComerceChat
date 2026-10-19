import type { CouponView, DynamicQrResolution } from '@comercechat/shared-types';
import { AccountLink } from '@/components/account-link';
import { apiAsUser, userToken } from '@/lib/user';
import { headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { api, ApiError } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { PayForm } from '../../t/[code]/pay-form';

export const metadata = { title: 'Pagar la cuenta · ComerceChat' };

const time = new Intl.DateTimeFormat('es-ES', { timeStyle: 'short', timeZone: 'Europe/Madrid' });

/** Pago con el QR de cobro que el personal genera desde la caja para una mesa (FR-QR-03). */
export default async function PosQrPage({ params }: PageProps<'/d/[token]'>) {
  const { token } = await params;
  let qr: DynamicQrResolution;
  try {
    qr = await api<DynamicQrResolution>(`/qr/dynamic/${encodeURIComponent(token)}`);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return (
      <main className="error-box">
        <h1>
          {err.problem.code === 'QR_INVALID'
            ? 'Este código ya no es válido'
            : 'No podemos mostrar el pago'}
        </h1>
        <p>Puede que ya esté pagado o que haya caducado. Pide al personal que genere uno nuevo.</p>
      </main>
    );
  }
  const host = (await headers()).get('host');
  const coupons = (await userToken())
    ? await apiAsUser<CouponView[]>(
        `/me/coupons?merchantId=${encodeURIComponent(qr.merchant.id)}`,
      ).catch(() => [])
    : [];
  return (
    <main>
      <header className="identity">
        <div className="logo" aria-hidden="true">
          {qr.merchant.brandName.charAt(0)}
        </div>
        <div>
          <h1>{qr.merchant.brandName}</h1>
          <p>{qr.location.address}</p>
          <span className="table-label">{qr.table.label}</span>
        </div>
      </header>
      {host && (
        <p className="domain-hint">
          Comprueba que la dirección empieza por <strong>{host}</strong> antes de pagar.
        </p>
      )}
      <AccountLink />
      <section className="card center">
        <p className="muted">Importe a pagar</p>
        <p className="psp-amount">{formatCents(qr.amountCents)}</p>
        <p className="muted small">Válido hasta las {time.format(new Date(qr.expiresAt))}</p>
      </section>
      <section className="card">
        <PayForm
          target={{ dynamicToken: token }}
          bill={null}
          fixedAmountCents={qr.amountCents}
          tips={qr.tips}
          guestMaxPaymentCents={Number.MAX_SAFE_INTEGER}
          idempotencyBase={randomUUID()}
          coupons={coupons}
        />
      </section>
    </main>
  );
}

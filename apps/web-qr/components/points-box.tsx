import type { CouponView, LoyaltyView, PaymentReceipt } from '@comercechat/shared-types';
import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { apiAsUser, userToken } from '@/lib/user';
import { ClaimButton } from './claim-button';
import { SignInFlow } from './sign-in-flow';

/** Puntos del pago en el justificante: guardarlos (con o sin cuenta) o ver que ya están guardados. */
export async function PointsBox({
  receipt,
  statusToken,
}: {
  receipt: PaymentReceipt;
  statusToken: string;
}) {
  const p = receipt.points;
  if (!p || p.points <= 0) return null;
  if (p.claimed) {
    // Con sesión: saldo y cupones del comensal en este comercio (incluido el de bienvenida).
    const loggedIn = Boolean(await userToken());
    const [loyalty, coupons] = loggedIn
      ? await Promise.all([
          apiAsUser<LoyaltyView[]>('/me/loyalty').catch(() => [] as LoyaltyView[]),
          apiAsUser<CouponView[]>(`/me/coupons?merchantId=${p.merchantId}`).catch(
            () => [] as CouponView[],
          ),
        ])
      : [[], []];
    const balance = loyalty.find((l) => l.merchant.id === p.merchantId)?.balance;
    return (
      <section className="card points" aria-live="polite">
        <p className="big">+{p.points} puntos guardados</p>
        <p className="muted">
          {balance !== undefined
            ? `Tienes ${balance} puntos en ${receipt.merchant.brandName}.`
            : `Guardados en tu cuenta de ${receipt.merchant.brandName}.`}
        </p>
        {coupons.length > 0 && (
          <div className="coupon-list">
            {coupons.map((c) => (
              <div key={c.id} className="coupon">
                <strong>🎁 {c.title}</strong>
                <span className="muted small">
                  {formatCents(c.discountCents)} de descuento
                  {c.minSpendCents > 0 && ` · a partir de ${formatCents(c.minSpendCents)}`}. Se
                  aplica al pagar con tu móvil.
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/cuenta">Ver mis puntos y cupones</Link>
      </section>
    );
  }
  if (!p.claimable) return null;
  const loggedIn = Boolean(await userToken());
  return (
    <section className="card points" aria-labelledby="points-title">
      <h2 id="points-title">
        Has ganado {p.points} puntos en {receipt.merchant.brandName}
      </h2>
      {loggedIn ? (
        <ClaimButton paymentId={receipt.paymentId} statusToken={statusToken} points={p.points} />
      ) : (
        <>
          <p className="muted">
            Guárdalos con tu móvil y canjéalos por invitaciones en tu próxima visita.
          </p>
          <SignInFlow
            claim={{
              paymentId: receipt.paymentId,
              statusToken,
              merchantId: p.merchantId,
              merchantName: receipt.merchant.brandName,
              points: p.points,
            }}
          />
        </>
      )}
    </section>
  );
}

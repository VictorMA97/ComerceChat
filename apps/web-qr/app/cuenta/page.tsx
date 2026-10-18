import type { CouponView, LoyaltyView, MeView } from '@comercechat/shared-types';
import { SignInFlow } from '@/components/sign-in-flow';
import { ApiError } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { apiAsUser, userToken } from '@/lib/user';
import { setConsent, signOut } from '@/lib/user-actions';
import { RedeemButton } from './redeem-button';

export const metadata = { title: 'Mis puntos · ComerceChat' };

const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'Europe/Madrid' });

/** Cuenta del comensal: puntos por comercio, recompensas, cupones y consentimientos (FR-LOY, FR-USR-04). */
export default async function AccountPage() {
  if (!(await userToken())) return <SignedOut />;
  let me: MeView, loyalty: LoyaltyView[], coupons: CouponView[];
  try {
    [me, loyalty, coupons] = await Promise.all([
      apiAsUser<MeView>('/me'),
      apiAsUser<LoyaltyView[]>('/me/loyalty'),
      apiAsUser<CouponView[]>('/me/coupons'),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.problem.status === 401) return <SignedOut />;
    throw err;
  }

  return (
    <main>
      <header className="card account-head">
        <div>
          <h1>{me.name ? `Hola, ${me.name}` : 'Mi cuenta'}</h1>
          <p className="muted small">{me.phoneMasked}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="chip">
            Salir
          </button>
        </form>
      </header>

      <section aria-labelledby="coupons-title">
        <h2 id="coupons-title" className="section-title">
          Mis cupones
        </h2>
        {coupons.length === 0 ? (
          <p className="card muted">Aún no tienes cupones. Canjea tus puntos por uno.</p>
        ) : (
          <div className="coupon-list">
            {coupons.map((c) => (
              <div key={c.id} className="coupon">
                <strong>🎁 {c.title}</strong>
                <span>
                  {formatCents(c.discountCents)} en {c.merchant.brandName}
                  {c.minSpendCents > 0 && ` · a partir de ${formatCents(c.minSpendCents)}`}
                </span>
                <span className="muted small">
                  Código {c.code} · hasta el {date.format(new Date(c.validTo))}. Se aplica al pagar
                  con tu móvil.
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="points-title">
        <h2 id="points-title" className="section-title">
          Mis puntos
        </h2>
        {loyalty.length === 0 && (
          <p className="card muted">Paga con tu móvil y guarda tus puntos para empezar.</p>
        )}
        {loyalty.map((l) => (
          <article key={l.merchant.id} className="card">
            <div className="points-head">
              <h3>{l.merchant.brandName}</h3>
              <p className="big">{l.balance} pts</p>
            </div>
            {l.pendingPoints > 0 && (
              <p className="muted small">{l.pendingPoints} puntos pendientes de confirmar.</p>
            )}
            <p className="muted small">{l.pointsPerEuro} punto por cada euro.</p>
            <ul className="rewards">
              {l.rewards.map((r) => (
                <li key={r.id}>
                  <span>
                    {r.name} <small className="muted">({formatCents(r.discountCents)})</small>
                  </span>
                  <span className="muted small">{r.costPoints} pts</span>
                  <RedeemButton rewardId={r.id} disabled={l.balance < r.costPoints} />
                </li>
              ))}
            </ul>
            <ConsentToggle
              label={`Compartir mis datos con ${l.merchant.brandName}`}
              kind="share"
              merchantId={l.merchant.id}
              granted={me.consents.sharedWith.some((s) => s.merchantId === l.merchant.id)}
            />
          </article>
        ))}
      </section>

      <section className="card">
        <h2 className="section-title">Privacidad</h2>
        <ConsentToggle
          label="Recibir ofertas de ComerceChat"
          kind="marketing"
          granted={me.consents.marketing}
        />
      </section>
    </main>
  );
}

function ConsentToggle({
  label,
  kind,
  merchantId,
  granted,
}: {
  label: string;
  kind: 'marketing' | 'share';
  merchantId?: string;
  granted: boolean;
}) {
  return (
    <form action={setConsent} className="consent-toggle">
      <input type="hidden" name="kind" value={kind} />
      {merchantId && <input type="hidden" name="merchantId" value={merchantId} />}
      <input type="hidden" name="granted" value={String(!granted)} />
      <span>{label}</span>
      <button type="submit" className="chip" aria-pressed={granted}>
        {granted ? 'Sí' : 'No'}
      </button>
    </form>
  );
}

function SignedOut() {
  return (
    <main>
      <section className="card">
        <h1>Mis puntos y cupones</h1>
        <p className="muted">Entra con tu móvil para ver tus puntos en cada restaurante.</p>
        <SignInFlow />
      </section>
    </main>
  );
}

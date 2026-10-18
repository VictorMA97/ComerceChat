import type { MerchantMe, PromotionView } from '@comercechat/shared-types';
import { Nav } from '@/components/nav';
import { apiOrLogin } from '@/lib/session';
import { endPromotion } from './actions';
import { PromotionForm } from './promotion-form';

export const metadata = { title: 'Promociones · ComerceChat' };

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const money = (cents: number) => eur.format(cents / 100);
const date = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeZone: 'Europe/Madrid' });

/** Promociones del comercio (FR-CPN-01, una plantilla en la PoC). */
export default async function PromotionsPage() {
  const [me, promos] = await Promise.all([
    apiOrLogin<MerchantMe>('/merchant/me'),
    apiOrLogin<PromotionView[]>('/merchant/promotions'),
  ]);
  const canEdit = me.role === 'OWNER' || me.role === 'MANAGER';
  return (
    <div className="shell">
      <Nav current="/promociones" />
      <h1>Promociones</h1>
      {canEdit && <PromotionForm />}
      <section className="promo-list" aria-label="Promociones">
        {promos.map((p) => (
          <article key={p.id} className="card promo">
            <header>
              <h2>{p.name}</h2>
              <span className={p.status === 'ACTIVE' ? 'badge' : 'badge badge-muted'}>
                {p.status === 'ACTIVE' ? 'Activa' : 'Terminada'}
              </span>
            </header>
            <p className="muted small">
              {money(p.discountCents)} de descuento
              {p.minSpendCents > 0 && ` a partir de ${money(p.minSpendCents)}`} · válido{' '}
              {p.validDays} días · desde el {date.format(new Date(p.createdAt))}
            </p>
            <p>
              <strong>{p.issued}</strong> cupones emitidos · <strong>{p.redeemed}</strong> canjeados
            </p>
            {canEdit && p.status === 'ACTIVE' && (
              <form action={endPromotion.bind(null, p.id)}>
                <button type="submit" className="link-button">
                  Terminar promoción
                </button>
              </form>
            )}
          </article>
        ))}
        {promos.length === 0 && <p className="muted">Aún no hay promociones.</p>}
      </section>
    </div>
  );
}

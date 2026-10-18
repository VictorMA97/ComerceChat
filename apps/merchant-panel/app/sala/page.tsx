import type { FloorTableStatus, FloorView } from '@comercechat/shared-types';
import { LiveRefresh } from '@/components/live-refresh';
import { Nav } from '@/components/nav';
import { apiOrLogin } from '@/lib/session';

export const metadata = { title: 'Sala · ComerceChat' };

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const money = (cents: number) => eur.format(cents / 100);
const time = new Intl.DateTimeFormat('es-ES', { timeStyle: 'short', timeZone: 'Europe/Madrid' });

const STATUS: Record<FloorTableStatus, { label: string; className: string }> = {
  FREE: { label: 'Libre', className: 'st-free' },
  OPEN: { label: 'Con cuenta', className: 'st-open' },
  PAYING: { label: 'Pagando', className: 'st-paying' },
  PARTIAL: { label: 'Pago parcial', className: 'st-partial' },
  PAID: { label: 'Pagada', className: 'st-paid' },
  POS_DOWN: { label: 'Caja sin conexión', className: 'st-down' },
};

/** Vista de sala del camarero (FR-MER-08), en tiempo real. */
export default async function FloorPage() {
  const floor = await apiOrLogin<FloorView[]>('/merchant/floor');
  return (
    <div className="shell">
      <LiveRefresh src="/api/events" />
      <Nav current="/sala" />
      {floor.map((loc) => (
        <section
          key={loc.locationId}
          className="location"
          aria-labelledby={`floor-${loc.locationId}`}
        >
          <div className="location-head">
            <h1 id={`floor-${loc.locationId}`}>{loc.locationName}</h1>
            <p className="muted">
              Hoy: {money(loc.paymentsTodayCents)} cobrados por QR · propinas{' '}
              <strong>{money(loc.tipsTodayCents)}</strong>
            </p>
          </div>
          <div className="floor">
            {loc.tables.map((t) => {
              const st = STATUS[t.status];
              return (
                <article
                  key={t.tableId}
                  className={`card floor-table ${st.className}`}
                  aria-label={`${t.label}: ${st.label}`}
                >
                  <header>
                    <h2>{t.label}</h2>
                    <span className="floor-status">{st.label}</span>
                  </header>
                  {t.totalCents > 0 && (
                    <dl>
                      <div>
                        <dt>Cuenta</dt>
                        <dd>{money(t.totalCents)}</dd>
                      </div>
                      {t.paidCents > 0 && (
                        <div>
                          <dt>Pagado</dt>
                          <dd>{money(t.paidCents)}</dd>
                        </div>
                      )}
                      {t.reservedCents > 0 && (
                        <div>
                          <dt>Pagando</dt>
                          <dd>{money(t.reservedCents)}</dd>
                        </div>
                      )}
                      <div>
                        <dt>Pendiente</dt>
                        <dd>{money(t.pendingCents)}</dd>
                      </div>
                    </dl>
                  )}
                  {(t.tipsTodayCents > 0 || t.lastPaymentAt) && (
                    <p className="floor-foot">
                      {t.tipsTodayCents > 0 && <>Propinas hoy {money(t.tipsTodayCents)}</>}
                      {t.lastPaymentAt && (
                        <> · último pago {time.format(new Date(t.lastPaymentAt))}</>
                      )}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

import type { FakePosState } from '@comercechat/shared-types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LiveRefresh } from '@/components/live-refresh';
import { Nav } from '@/components/nav';
import { api, isUnauthenticated, SESSION_COOKIE } from '@/lib/api';
import { addItem, closeBill, removeItem, setHealth } from './actions';
import { PaymentQr } from './payment-qr';

export const metadata = { title: 'Simulador de caja · ComerceChat' };

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const money = (cents: number) => eur.format(cents / 100);
const time = new Intl.DateTimeFormat('es-ES', { timeStyle: 'short', timeZone: 'Europe/Madrid' });

/** Simulador del software de caja del restaurante (ARCHITECTURE §16.3). Solo PoC. */
export default async function PosSimulatorPage() {
  if (!(await cookies()).get(SESSION_COOKIE)) redirect('/login');
  let states: FakePosState[];
  try {
    states = await api<FakePosState[]>('/merchant/fake-pos');
  } catch (err) {
    if (isUnauthenticated(err)) redirect('/login');
    throw err;
  }

  return (
    <div className="shell">
      <LiveRefresh src="/api/events" />
      <Nav current="/pos-simulator" />
      <p className="poc-banner">
        Simulador del software de caja (TPV) del restaurante. En el MVP esto lo hace el TPV real
        (D-02).
      </p>
      <header className="topbar">
        <div>
          <h1>Simulador de caja</h1>
          <span className="muted">
            Abre cuentas, añade platos, cobra una mesa con QR y mira cómo llegan los pagos.
          </span>
        </div>
      </header>

      {states.map((loc) => (
        <section
          key={loc.locationId}
          className="location"
          aria-labelledby={`pos-${loc.locationId}`}
        >
          <div className="location-head">
            <h2 id={`pos-${loc.locationId}`}>{loc.locationName}</h2>
            <form action={setHealth.bind(null, loc.locationId, loc.health === 'down')}>
              <span className={loc.health === 'ok' ? 'badge' : 'badge badge-danger'}>
                TPV {loc.health === 'ok' ? 'en línea' : 'caído'}
              </span>{' '}
              <button type="submit">
                {loc.health === 'ok' ? 'Simular caída' : 'Recuperar TPV'}
              </button>
            </form>
          </div>

          <div className="pos-tables">
            {loc.tables.map((t) => {
              const pending = t.bill ? Math.max(0, t.bill.totalCents - t.bill.paidCents) : 0;
              const closed = t.bill?.status === 'CLOSED';
              return (
                <article key={t.tableId} className="card pos-table">
                  <header className="pos-table-head">
                    <h3>{t.tableLabel}</h3>
                    {t.bill ? (
                      <span className={pending === 0 || closed ? 'badge' : 'badge badge-warn'}>
                        {closed
                          ? `Cerrada ${time.format(new Date(t.bill.closedAt!))}`
                          : pending === 0
                            ? 'Pagada'
                            : `Pendiente ${money(pending)}`}
                      </span>
                    ) : (
                      <span className="muted">Libre</span>
                    )}
                  </header>

                  {t.bill && (
                    <>
                      <ul className="pos-lines">
                        {t.bill.items.map((i) => (
                          <li key={i.id}>
                            <span>
                              {i.qty}× {i.name}
                            </span>
                            <span className="pos-amount">{money(i.qty * i.unitPriceCents)}</span>
                            {!closed && (
                              <form action={removeItem.bind(null, i.id)}>
                                <button
                                  type="submit"
                                  className="icon-button"
                                  aria-label={`Quitar ${i.name}`}
                                >
                                  ×
                                </button>
                              </form>
                            )}
                          </li>
                        ))}
                      </ul>
                      <p className="pos-total">
                        Total <strong>{money(t.bill.totalCents)}</strong>
                      </p>
                      {t.bill.payments.length > 0 && (
                        <ul className="pos-payments">
                          {t.bill.payments.map((p) => (
                            <li key={p.reference}>
                              ✓ {time.format(new Date(p.createdAt))} · ComerceChat{' '}
                              {money(p.amountCents)}
                              {p.tipCents > 0 && ` + propina ${money(p.tipCents)}`}
                              {p.discountCents > 0 && ` (cupón −${money(p.discountCents)})`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  <PaymentQr
                    tableId={t.tableId}
                    qr={t.paymentQr}
                    canCharge={Boolean(t.bill) && !closed && pending > 0}
                  />

                  <form action={addItem.bind(null, t.tableId)} className="pos-add">
                    <label className="sr-only" htmlFor={`menu-${t.tableId}`}>
                      Plato
                    </label>
                    <select id={`menu-${t.tableId}`} name="menuItemId" required>
                      {loc.menu.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {money(m.priceCents)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="qty"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={1}
                      aria-label="Cantidad"
                    />
                    <button type="submit">Añadir</button>
                  </form>

                  {closed && (
                    <p className="muted small">Al añadir un plato se abre una cuenta nueva.</p>
                  )}
                  {t.bill && !closed && (
                    <form action={closeBill.bind(null, t.tableId)}>
                      <button type="submit" className="link-button">
                        Cerrar cuenta (cobrada fuera de ComerceChat)
                      </button>
                    </form>
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

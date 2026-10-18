import type { AnalyticsPeriod, AnalyticsTotals, AnalyticsView } from '@comercechat/shared-types';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { apiOrLogin } from '@/lib/session';
import { DailyChart } from './daily-chart';

export const metadata = { title: 'Analítica · ComerceChat' };

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const money = (cents: number) => eur.format(cents / 100);
const PERIODS: { id: AnalyticsPeriod; label: string; vs: string }[] = [
  { id: 'today', label: 'Hoy', vs: 'ayer' },
  { id: 'week', label: '7 días', vs: 'los 7 días anteriores' },
  { id: 'month', label: '30 días', vs: 'los 30 días anteriores' },
];
const TILES: { key: keyof AnalyticsTotals; label: string; format: (v: number) => string }[] = [
  { key: 'volumeCents', label: 'Ventas por QR', format: money },
  { key: 'payments', label: 'Pagos', format: String },
  { key: 'avgTicketCents', label: 'Ticket medio', format: money },
  { key: 'tipsCents', label: 'Propinas', format: money },
  { key: 'discountsCents', label: 'Descuentos con cupón', format: money },
  { key: 'identifiedCustomers', label: 'Clientes identificados', format: String },
];

function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0)
    return <span className="delta muted">{now === 0 ? 'sin cambios' : 'nuevo'}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  return (
    <span className={`delta ${pct > 0 ? 'up' : pct < 0 ? 'down' : 'muted'}`}>
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct)} %
    </span>
  );
}

/** Panel de inicio del comercio (FR-ANA-01, versión reducida de la PoC). */
export default async function AnalyticsPage({ searchParams }: PageProps<'/analitica'>) {
  const { period: raw } = await searchParams;
  const period = PERIODS.find((p) => p.id === raw) ?? PERIODS[0]!;
  const a = await apiOrLogin<AnalyticsView>(`/merchant/analytics?period=${period.id}`);

  return (
    <div className="shell">
      <Nav current="/analitica" />
      <div className="location-head">
        <h1>Analítica</h1>
        <div className="segmented" role="group" aria-label="Periodo">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={`/analitica?period=${p.id}`}
              aria-current={p.id === period.id ? 'true' : undefined}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <p className="muted">Solo pagos hechos con ComerceChat. Comparado con {period.vs}.</p>

      <div className="tiles">
        {TILES.map((t) => (
          <article key={t.key} className="card tile">
            <p className="tile-label">{t.label}</p>
            <p className="tile-value">{t.format(a.current[t.key])}</p>
            <Delta now={a.current[t.key]} before={a.previous[t.key]} />
          </article>
        ))}
      </div>

      {a.daily.length > 1 && (
        <section className="card chart-card" aria-labelledby="daily-title">
          <h2 id="daily-title">Ventas por QR por día</h2>
          <DailyChart days={a.daily} />
          <details>
            <summary>Ver los datos en tabla</summary>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Día</th>
                  <th scope="col">Ventas</th>
                  <th scope="col">Pagos</th>
                </tr>
              </thead>
              <tbody>
                {a.daily.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{money(d.volumeCents)}</td>
                    <td>{d.payments}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}
    </div>
  );
}

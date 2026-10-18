import type { PaymentReceipt } from '@comercechat/shared-types';
import { api, ApiError } from '@/lib/api';
import { formatCents } from '@/lib/money';
import { PointsBox } from '@/components/points-box';
import { cancelPayment } from './actions';
import { AutoRefresh } from './auto-refresh';

export const metadata = { title: 'Tu pago · ComerceChat' };

const FAILURE_MESSAGES: Record<string, string> = {
  card_declined: 'Tu banco ha rechazado la tarjeta.',
  authentication_failed: 'No se ha podido verificar el pago con tu banco.',
  EXPIRED: 'La sesión de pago ha caducado.',
  SUPERSEDED: 'Has iniciado otro pago desde este móvil.',
  CANCELLED_BY_PAYER: 'Has cancelado el pago. No se ha realizado ningún cargo.',
};

const dateTime = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

export default async function PaymentStatusPage({ params, searchParams }: PageProps<'/p/[id]'>) {
  const { id } = await params;
  const { t } = await searchParams;
  let r: PaymentReceipt;
  try {
    r = await api<PaymentReceipt>(
      `/payments/${encodeURIComponent(id)}?t=${encodeURIComponent(String(t ?? ''))}`,
    );
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return (
      <main className="error-box">
        <h1>Pago no encontrado</h1>
      </main>
    );
  }

  if (r.status === 'CREATED' || r.status === 'AUTHORIZED') {
    return (
      <main className="status">
        <AutoRefresh />
        <section className="card center" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <h1>Confirmando tu pago…</h1>
          <p className="muted">
            Esperamos la confirmación del proveedor de pagos. No cierres esta página.
          </p>
          <form action={cancelPayment.bind(null, r.paymentId, String(t ?? ''))}>
            <button type="submit" className="psp-secondary">
              He abandonado el pago: liberar mi parte
            </button>
          </form>
          <p className="muted small">Después vuelve a escanear el QR de la mesa.</p>
        </section>
      </main>
    );
  }

  if (r.status === 'FAILED') {
    return (
      <main className="status">
        <section className="card center" aria-live="polite">
          <h1>El pago no se ha completado</h1>
          <p>{FAILURE_MESSAGES[r.failureReason ?? ''] ?? 'No se ha realizado ningún cargo.'}</p>
          <p className="muted">Vuelve a escanear el QR de la mesa para intentarlo de nuevo.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="status">
      <section className="card center" aria-live="polite">
        <div className="check" aria-hidden="true">
          ✓
        </div>
        <h1>¡Pago completado!</h1>
        <p className="muted">
          {r.merchant.brandName}
          {r.table ? ` · ${r.table.label}` : ''}
        </p>
      </section>

      <section className="card receipt" aria-labelledby="receipt-title">
        <h2 id="receipt-title">Justificante de pago</h2>
        <dl className="totals">
          <div>
            <dt>Cuenta</dt>
            <dd>{formatCents(r.amountCents)}</dd>
          </div>
          {r.discountCents > 0 && (
            <div className="discount">
              <dt>{r.couponTitle ?? 'Cupón'}</dt>
              <dd>−{formatCents(r.discountCents)}</dd>
            </div>
          )}
          {r.tipCents > 0 && (
            <div>
              <dt>Propina</dt>
              <dd>{formatCents(r.tipCents)}</dd>
            </div>
          )}
          <div className="grand">
            <dt>Total pagado</dt>
            <dd>{formatCents(r.totalCents)}</dd>
          </div>
        </dl>
        <dl className="meta">
          <div>
            <dt>Comercio</dt>
            <dd>
              {r.location.name}
              <br />
              {r.location.address}
            </dd>
          </div>
          {r.capturedAt && (
            <div>
              <dt>Fecha</dt>
              <dd>{dateTime.format(new Date(r.capturedAt))}</dd>
            </div>
          )}
          {r.cardLast4 && (
            <div>
              <dt>Medio de pago</dt>
              <dd>Tarjeta •••• {r.cardLast4}</dd>
            </div>
          )}
          <div>
            <dt>Referencia</dt>
            <dd className="mono">{r.paymentId}</dd>
          </div>
        </dl>
        <p className="legal">
          Justificante de pago, no válido como factura. La factura la emite el establecimiento.
        </p>
      </section>

      <PointsBox receipt={r} statusToken={String(t ?? '')} />
    </main>
  );
}

import type { DynamicQrView } from '@comercechat/shared-types';
import QRCode from 'qrcode';
import { revokePaymentQr } from './actions';
import { PaymentQrButton } from './payment-qr-button';

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const money = (cents: number) => eur.format(cents / 100);
const time = new Intl.DateTimeFormat('es-ES', { timeStyle: 'short', timeZone: 'Europe/Madrid' });

/**
 * QR de cobro de la mesa generado desde la caja (FR-QR-03): el camarero lo enseña y el cliente paga
 * lo que queda con su móvil. Se actualiza en tiempo real al cobrarse.
 */
export async function PaymentQr({
  tableId,
  qr,
  canCharge,
}: {
  tableId: string;
  qr: DynamicQrView | null;
  canCharge: boolean;
}) {
  if (qr?.payment?.status === 'CAPTURED') {
    return (
      <p className="pos-qr-paid" aria-live="polite">
        ✓ Cobrado con QR {money(qr.amountCents)}
        {qr.payment.tipCents > 0 && ` + propina ${money(qr.payment.tipCents)}`}
        {qr.payment.capturedAt && ` · ${time.format(new Date(qr.payment.capturedAt))}`}
      </p>
    );
  }
  if (qr?.status === 'ACTIVE') {
    const svg = await QRCode.toString(qr.url, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
    });
    return (
      <div className="pos-qr" aria-live="polite">
        <div
          className="pos-qr-code"
          role="img"
          aria-label={`QR de cobro de ${money(qr.amountCents)}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="pos-qr-amount">{money(qr.amountCents)}</p>
        <p className="muted small">
          {qr.payment?.status === 'CREATED' ? 'El cliente está pagando…' : 'Enséñalo al cliente'} ·
          válido hasta las {time.format(new Date(qr.expiresAt))}
        </p>
        <form action={revokePaymentQr.bind(null, qr.id)}>
          <button type="submit" className="link-button">
            Anular QR
          </button>
        </form>
      </div>
    );
  }
  if (!canCharge) return null;
  return (
    <>
      {qr?.status === 'EXPIRED' && <p className="muted small">El último QR de cobro caducó.</p>}
      <PaymentQrButton
        tableId={tableId}
        label={qr?.status === 'EXPIRED' ? 'Generar otro QR' : 'Cobrar con QR'}
      />
    </>
  );
}

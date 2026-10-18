import type { QrResolution } from '@comercechat/shared-types';

/** Cabecera de identidad del comercio: visible sin scroll en 360 px (FR-QR-04). */
export function MerchantHeader({ qr, host }: { qr: QrResolution; host: string | null }) {
  return (
    <>
      <header className="identity">
        <div className="logo" aria-hidden="true">
          {qr.merchant.brandName.charAt(0)}
        </div>
        <div>
          <h1>{qr.merchant.brandName}</h1>
          <p>{qr.location.address}</p>
          {qr.table && <span className="table-label">{qr.table.label}</span>}
        </div>
      </header>
      {host && (
        <p className="domain-hint">
          Comprueba que la dirección empieza por <strong>{host}</strong> antes de pagar.
        </p>
      )}
    </>
  );
}

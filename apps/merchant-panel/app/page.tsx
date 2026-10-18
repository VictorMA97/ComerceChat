import type { LocationView, MerchantMe } from '@comercechat/shared-types';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { PrintButton, RegenerateQrButton } from '@/components/table-actions';
import { logout } from '@/lib/actions';
import { api, isUnauthenticated, SESSION_COOKIE } from '@/lib/api';

const qrSvg = (url: string) =>
  QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });

export default async function TablesPage() {
  if (!(await cookies()).get(SESSION_COOKIE)) redirect('/login');

  let me: MerchantMe;
  let locations: LocationView[];
  try {
    [me, locations] = await Promise.all([
      api<MerchantMe>('/merchant/me'),
      api<LocationView[]>('/merchant/locations'),
    ]);
  } catch (err) {
    if (isUnauthenticated(err)) redirect('/login');
    throw err;
  }

  const canRegenerate = me.role === 'OWNER' || me.role === 'MANAGER';
  // La API es la fuente de verdad de la URL pública (cambia con `pnpm poc:tunnel`).
  const firstQrUrl = locations.flatMap((l) => l.tables).find((t) => t.qr)?.qr?.url;
  const qrOrigin = firstQrUrl ? new URL(firstQrUrl).origin : '(sin QR)';
  const svgs = new Map(
    await Promise.all(
      locations.flatMap((l) =>
        l.tables.filter((t) => t.qr).map(async (t) => [t.id, await qrSvg(t.qr!.url)] as const),
      ),
    ),
  );

  return (
    <div className="shell">
      <p className="poc-banner">
        PoC local: sin pagos reales. Los QR apuntan a <code>{qrOrigin}</code>.
      </p>
      <header className="topbar no-print">
        <div>
          <h1>{me.merchant.brandName}</h1>
          <span className="muted">
            {me.email} · <span className="badge">{me.role}</span>
          </span>
        </div>
        <div className="table-actions">
          <Link className="button nav-link" href="/pos-simulator">
            Simulador de caja
          </Link>
          <PrintButton />
          <form action={logout}>
            <button type="submit">Salir</button>
          </form>
        </div>
      </header>

      {locations.map((l) => (
        <section key={l.id} className="location" aria-labelledby={`loc-${l.id}`}>
          <h2 id={`loc-${l.id}`}>{l.name}</h2>
          <p className="muted no-print">
            {l.address} · {l.tables.length} mesas
          </p>
          <div className="tables">
            {l.tables.map((t) => (
              <article key={t.id} className="card table-card">
                <h3>{t.label}</h3>
                {t.qr ? (
                  <>
                    <div
                      className="qr"
                      role="img"
                      aria-label={`Código QR de ${t.label}`}
                      dangerouslySetInnerHTML={{ __html: svgs.get(t.id)! }}
                    />
                    <p className="qr-cta">Paga sin esperar · divide la cuenta en 10 s</p>
                    <a className="qr-url no-print" href={t.qr.url} target="_blank" rel="noreferrer">
                      {t.qr.url}
                    </a>
                  </>
                ) : (
                  <p className="muted">Sin QR activo</p>
                )}
                {canRegenerate && (
                  <div className="no-print">
                    <RegenerateQrButton tableId={t.id} label={t.label} />
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

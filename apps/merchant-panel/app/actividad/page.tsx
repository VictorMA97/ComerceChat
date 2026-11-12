import type { AuditPage, MerchantMe } from '@comercechat/shared-types';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { apiOrLogin } from '@/lib/session';

export const metadata = { title: 'Actividad · ComerceChat' };

const when = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Madrid',
});

/** Texto de cada acción registrada (ADR-028). Las desconocidas se muestran tal cual. */
const ACTIONS: Record<string, string> = {
  'merchant.registered': 'Registro del comercio',
  'merchant.psp_onboarding_simulated': 'Alta en el proveedor de pagos (simulada)',
  'merchant_user.login': 'Inicio de sesión',
  'merchant_user.logout': 'Cierre de sesión',
  'merchant_user.mfa_enabled': 'Doble factor activado',
  'merchant_user.mfa_failed': 'Código de doble factor incorrecto',
  'merchant_user.mfa_recovery_code_used': 'Entrada con código de recuperación',
  'location.created': 'Local creado',
  'tables.created': 'Mesas creadas',
  'qr.regenerated': 'QR de mesa regenerado',
  'qr.payment_qr_created': 'QR de cobro generado en la caja',
  'promotion.created': 'Promoción creada',
  'payment.captured_after_cancel': 'Pago cobrado después de cancelarse (revisar)',
  'payment.discount_without_coupon': 'Pago con descuento sin cupón (revisar)',
};

/** Acciones que merecen atención: fallos de acceso y anomalías de pago. */
const WARN = new Set([
  'merchant_user.mfa_failed',
  'merchant_user.mfa_recovery_code_used',
  'payment.captured_after_cancel',
  'payment.discount_without_coupon',
]);

/** Registro de actividad del comercio (solo OWNER): accesos y cambios relevantes. */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ antes?: string }>;
}) {
  const { antes } = await searchParams;
  const me = await apiOrLogin<MerchantMe>('/merchant/me');
  if (me.role !== 'OWNER') {
    return (
      <div className="shell">
        <Nav current="/actividad" />
        <h1>Actividad</h1>
        <p className="muted">
          Solo el propietario de la cuenta puede ver el registro de actividad.
        </p>
      </div>
    );
  }
  const page = await apiOrLogin<AuditPage>(
    `/merchant/audit?limit=50${antes ? `&before=${encodeURIComponent(antes)}` : ''}`,
  );
  return (
    <div className="shell">
      <Nav current="/actividad" />
      <h1>Actividad</h1>
      <p className="muted">
        Accesos al panel y cambios en la cuenta. El registro no se puede modificar ni borrar.
      </p>
      {page.items.length === 0 ? (
        <p className="muted">Aún no hay actividad.</p>
      ) : (
        <table className="activity">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Acción</th>
              <th scope="col">Quién</th>
              <th scope="col">IP</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((e) => (
              <tr key={e.id} className={WARN.has(e.action) ? 'activity-warn' : undefined}>
                <td>{when.format(new Date(e.at))}</td>
                <td>{ACTIONS[e.action] ?? e.action}</td>
                <td>{e.actor.email ?? (e.actor.type === 'SYSTEM' ? 'Sistema' : '—')}</td>
                <td>
                  <code>{e.ip ?? '—'}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="activity-nav">
        {antes && <Link href="/actividad">← Más recientes</Link>}
        {page.nextCursor && (
          <Link href={`/actividad?antes=${encodeURIComponent(page.nextCursor)}`}>Anteriores →</Link>
        )}
      </p>
    </div>
  );
}

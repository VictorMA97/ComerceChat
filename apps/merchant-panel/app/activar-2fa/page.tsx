import type { MfaSetupResponse } from '@comercechat/shared-types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { MfaActivation } from '@/components/mfa-activation';
import { api, ApiError, MFA_COOKIE, SESSION_COOKIE } from '@/lib/api';
import { qrDataUrl } from '@/lib/qr';

/**
 * Alta del doble factor (ADR-025). Se llega tras el registro o tras un login de OWNER/MANAGER que aún
 * no lo tiene. Al activarlo, la cookie intermedia desaparece y la página se vuelve a pintar sin
 * secreto: el mismo componente sigue mostrando los códigos de recuperación.
 */
export default async function ActivateMfaPage() {
  const jar = await cookies();
  const mfaToken = jar.get(MFA_COOKIE)?.value;
  if (!mfaToken && !jar.get(SESSION_COOKIE)) redirect('/login');

  let setup: (MfaSetupResponse & { qr: string }) | null = null;
  let error: string | undefined;
  if (mfaToken) {
    try {
      const res = await api<MfaSetupResponse>('/merchant/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ mfaToken }),
      });
      setup = { ...res, qr: await qrDataUrl(res.otpauthUri) };
    } catch (err) {
      error = err instanceof ApiError ? err.problem.title : 'No se ha podido preparar el alta';
    }
  }

  return (
    <main className="card login">
      <h1>Activa el doble factor</h1>
      <MfaActivation setup={setup} loadError={error} />
    </main>
  );
}

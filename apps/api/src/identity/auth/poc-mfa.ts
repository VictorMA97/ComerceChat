// Doble factor de las cuentas de prueba de la PoC (`pnpm db:seed`). Secreto público y conocido: solo
// para datos de prueba en local, nunca para cuentas reales (el seed no corre en producción).
import { totp } from './totp.js';

export const POC_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

/** `pnpm poc:totp`: imprime el código actual para entrar al panel con las cuentas de prueba. */
if (process.argv[1]?.endsWith('poc-mfa.ts')) {
  const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
  console.log(`${totp(POC_TOTP_SECRET)}  (caduca en ${secondsLeft} s)`);
}

// Sesión del panel en los E2E: contraseña + segundo factor (ADR-025) con el secreto de prueba.
import type request from 'supertest';
import { expect } from 'vitest';
import { POC_TOTP_SECRET } from '../src/identity/auth/poc-mfa.js';
import { totp } from '../src/identity/auth/totp.js';
import { encryptPii } from '@comercechat/service-kit';
import type { Env } from '../src/config/env.js';

/** Columnas para insertar un usuario del comercio con el doble factor ya activado. */
export const testMfaColumns = (env: Env) => ({
  mfaEnabled: true,
  mfaSecretEnc: encryptPii(POC_TOTP_SECRET, env.PII_ENCRYPTION_KEY),
  mfaEnabledAt: new Date(),
});

/**
 * Inicia sesión y devuelve el token. `post` crea la petición (con las cabeceras que quiera el test).
 * El mismo código TOTP no vale dos veces, así que cada usuario debe entrar una sola vez por test.
 */
export async function merchantLogin(
  post: (path: string) => request.Test,
  email: string,
  password = 'secreto123',
): Promise<string> {
  const login = await post('/v1/merchant/auth/login').send({ email, password });
  expect(login.status).toBe(200);
  if (login.body.step === 'DONE') return login.body.accessToken as string;
  expect(login.body.step).toBe('MFA_REQUIRED');
  const verify = await post('/v1/merchant/auth/mfa/verify').send({
    mfaToken: login.body.mfaToken,
    code: totp(POC_TOTP_SECRET),
  });
  expect(verify.status).toBe(200);
  return verify.body.accessToken as string;
}

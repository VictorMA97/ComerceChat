import type { MerchantUserRole } from '@comercechat/shared-types';

/** Identidad de un usuario del panel de comercio, tal como viaja en el JWT. */
export interface MerchantPrincipal {
  merchantUserId: string;
  merchantId: string;
  role: MerchantUserRole;
}

/**
 * Proveedor de autenticación de comercios (D-03). En la PoC: `LocalMerchantAuthProvider`
 * (email + contraseña, sin doble factor). En M0 se añade el doble factor obligatorio (ADR-013).
 */
export interface MerchantAuthProvider {
  authenticate(email: string, password: string): Promise<MerchantPrincipal | null>;
}

export const MERCHANT_AUTH_PROVIDER = Symbol('MERCHANT_AUTH_PROVIDER');

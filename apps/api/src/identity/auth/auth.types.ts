import type { MerchantPrincipal } from '@comercechat/auth-client';

export type { MerchantPrincipal };

/**
 * Proveedor de autenticación de comercios (D-03). En la PoC: `LocalMerchantAuthProvider`
 * (email + contraseña). El doble factor (ADR-025) va aparte, en `MerchantMfaService`.
 */
export interface MerchantAuthProvider {
  authenticate(email: string, password: string): Promise<MerchantPrincipal | null>;
}

export const MERCHANT_AUTH_PROVIDER = Symbol('MERCHANT_AUTH_PROVIDER');

// Enums de dominio compartidos entre API y frontends. Deben coincidir con los enums de Postgres
// definidos en apps/api/src/db/schema (ARCHITECTURE §10).

export const MerchantStatus = {
  ONBOARDING: 'ONBOARDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  REJECTED: 'REJECTED',
} as const;
export type MerchantStatus = (typeof MerchantStatus)[keyof typeof MerchantStatus];

export const MerchantUserRole = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;
export type MerchantUserRole = (typeof MerchantUserRole)[keyof typeof MerchantUserRole];

export const QrCodeType = {
  STATIC_TABLE: 'STATIC_TABLE',
  STATIC_COUNTER: 'STATIC_COUNTER',
  DYNAMIC_AMOUNT: 'DYNAMIC_AMOUNT',
} as const;
export type QrCodeType = (typeof QrCodeType)[keyof typeof QrCodeType];

export const QrCodeStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
  CONSUMED: 'CONSUMED',
  EXPIRED: 'EXPIRED',
} as const;
export type QrCodeStatus = (typeof QrCodeStatus)[keyof typeof QrCodeStatus];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  DELETED: 'DELETED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ConsentType = {
  TERMS: 'TERMS',
  MKT_PLATFORM: 'MKT_PLATFORM',
  SHARE_WITH_MERCHANT: 'SHARE_WITH_MERCHANT',
} as const;
export type ConsentType = (typeof ConsentType)[keyof typeof ConsentType];

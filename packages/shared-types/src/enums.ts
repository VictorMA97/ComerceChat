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

export const OrderSource = {
  QR: 'QR',
  POS: 'POS',
  COUNTER: 'COUNTER',
} as const;
export type OrderSource = (typeof OrderSource)[keyof typeof OrderSource];

export const OrderStatus = {
  OPEN: 'OPEN',
  SENT: 'SENT',
  IN_PREPARATION: 'IN_PREPARATION',
  SERVED: 'SERVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentMethod = {
  CARD: 'CARD',
  APPLE_PAY: 'APPLE_PAY',
  GOOGLE_PAY: 'GOOGLE_PAY',
  BIZUM: 'BIZUM',
  ALIPAY_PLUS: 'ALIPAY_PLUS',
  WECHAT_PAY: 'WECHAT_PAY',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Máquina de estados de SPEC §7. "Pagado" solo por webhook firmado (ADR-015). */
export const PaymentStatus = {
  CREATED: 'CREATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
  CHARGED_BACK: 'CHARGED_BACK',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const TransactionType = {
  CHARGE: 'CHARGE',
  REFUND: 'REFUND',
  CHARGEBACK: 'CHARGEBACK',
  CHARGEBACK_REVERSAL: 'CHARGEBACK_REVERSAL',
  PAYOUT: 'PAYOUT',
  FEE: 'FEE',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

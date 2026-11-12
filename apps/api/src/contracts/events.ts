// Catálogo de eventos de dominio entre contextos (ADR-029, MIGRACION §3.3). En F2 pasa a
// packages/contracts. Cada evento lleva los datos que necesitan sus consumidores, para que ninguno
// lea tablas de otro contexto. La entrega es «al menos una vez» y sin orden: todo consumidor es
// idempotente (ADR-026). Un cambio incompatible en un evento es un tipo nuevo (`.v2`), no una edición.

/** Contextos que consumen eventos. Cada uno tiene su cola: `domain-events-<consumidor>`. */
export const CONSUMERS = ['table-payments', 'loyalty', 'analytics', 'audit'] as const;
export type Consumer = (typeof CONSUMERS)[number];

/** Pago capturado por webhook del PSP (ADR-015). Productor: table-payments. */
export interface PaymentCapturedV1 {
  paymentId: string;
  merchantId: string;
  locationId: string;
  tableId: string | null;
  /** Comensal identificado al pagar; `null` si pagó sin cuenta (puede reclamarlo después). */
  userId: string | null;
  /** Lo que cubre el pago, incluida la parte pagada con cupón. */
  amountCents: number;
  discountCents: number;
  tipCents: number;
  platformFeeCents: number;
  currency: string;
  capturedAt: string;
}

/** Un pago hecho sin cuenta pasa a ser de un comensal al reclamar sus puntos (FR-USR-02). */
export interface PaymentUserAssignedV1 {
  paymentId: string;
  merchantId: string;
  userId: string;
}

/**
 * loyalty emite un cupón (recompensa o promoción) en la misma transacción que su apunte de puntos;
 * table-payments lo crea con ese id para que se pueda reservar y canjear al pagar (FR-CPN-04).
 */
export interface CouponIssuedV1 {
  couponId: string;
  code: string;
  merchantId: string;
  userId: string;
  title: string;
  discountCents: number;
  minSpendCents: number;
  validFrom: string;
  validTo: string;
}

/** Cupón canjeado al capturarse el pago que lo usó (FR-CPN-06). Productor: table-payments. */
export interface CouponRedeemedV1 {
  couponId: string;
  paymentId: string;
  merchantId: string;
  discountCents: number;
  redeemedAt: string;
}

/** QR estático de mesa revocado al regenerarlo (FR-QR-05). Productor: merchant-venues. */
export interface QrRevokedV1 {
  qrId: string;
  tableId: string;
  replacedBy: string;
}

export interface DomainEvents {
  'PaymentCaptured.v1': PaymentCapturedV1;
  'PaymentUserAssigned.v1': PaymentUserAssignedV1;
  'CouponIssued.v1': CouponIssuedV1;
  'CouponRedeemed.v1': CouponRedeemedV1;
  'QrRevoked.v1': QrRevokedV1;
}
export type DomainEventType = keyof DomainEvents;

/**
 * Quién recibe cada evento. El relé del outbox publica una copia en la cola de cada consumidor, y un
 * consumidor solo puede suscribirse a lo que figura aquí (lo comprueba `OutboxRelayService.on`).
 */
export const SUBSCRIPTIONS: { readonly [T in DomainEventType]: readonly Consumer[] } = {
  'PaymentCaptured.v1': ['table-payments', 'loyalty', 'analytics'],
  'PaymentUserAssigned.v1': ['analytics'],
  'CouponIssued.v1': ['table-payments'],
  'CouponRedeemed.v1': ['loyalty'],
  'QrRevoked.v1': [],
};

export const domainEventsQueue = (consumer: Consumer) => `domain-events-${consumer}` as const;

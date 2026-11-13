// Esquema completo para el cliente de Drizzle, drizzle-kit, el seed y los tests. Cada contexto define
// sus tablas en `src/<contexto>/schema/`, en su propio esquema de Postgres, y solo importa las suyas
// (ADR-029, dependency-cruiser). Entre contextos no hay claves foráneas.
export { idempotencyKeys, outboxEvents, platformSchema } from '@comercechat/service-kit/db';
export * from '../../identity/schema/pg-schema.js';
export * from '../../identity/schema/enums.js';
export * from '../../identity/schema/merchant-users.js';
export * from '../../identity/schema/users.js';
export * from '../../merchant-venues/schema/pg-schema.js';
export * from '../../merchant-venues/schema/enums.js';
export * from '../../merchant-venues/schema/merchants.js';
export * from '../../merchant-venues/schema/qr.js';
export * from '../../table-payments/schema/pg-schema.js';
export * from '../../table-payments/schema/enums.js';
export * from '../../table-payments/schema/orders.js';
export * from '../../table-payments/schema/payment-qr.js';
export * from '../../table-payments/schema/payments.js';
export * from '../../table-payments/schema/coupons.js';
export * from '../../loyalty/schema/pg-schema.js';
export * from '../../loyalty/schema/loyalty.js';
export * from '../../audit/schema/pg-schema.js';
export * from '../../audit/schema/audit.js';
export * from '../../analytics/schema/pg-schema.js';
export * from '../../analytics/schema/analytics.js';
export * from '../../fake-pos/schema/pg-schema.js';
export * from '../../fake-pos/schema/fake-pos.js';

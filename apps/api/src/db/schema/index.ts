// Esquema completo para el cliente de Drizzle, drizzle-kit, el seed y los tests. Cada contexto define
// sus tablas en `src/<contexto>/schema/` y solo importa las suyas (ADR-029, dependency-cruiser).
export * from './enums.js';
export * from './platform.js';
export * from '../../identity/schema/merchant-users.js';
export * from '../../identity/schema/users.js';
export * from '../../merchant-venues/schema/merchants.js';
export * from '../../merchant-venues/schema/qr.js';
export * from '../../table-payments/schema/orders.js';
export * from '../../table-payments/schema/payments.js';
export * from '../../table-payments/schema/coupons.js';
export * from '../../loyalty/schema/loyalty.js';
export * from '../../audit/schema/audit.js';
export * from '../../fake-pos/schema/fake-pos.js';
export * from '../../fake-psp/schema/fake-psp.js';

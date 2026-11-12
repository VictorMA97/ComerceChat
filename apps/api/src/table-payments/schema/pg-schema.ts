import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto table-payments (ADR-029). Solo este contexto usa sus tablas. */
export const paymentsSchema = pgSchema('payments');

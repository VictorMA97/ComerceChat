import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto loyalty (ADR-029). Solo este contexto usa sus tablas. */
export const loyaltySchema = pgSchema('loyalty');

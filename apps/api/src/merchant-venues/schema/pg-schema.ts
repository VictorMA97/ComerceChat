import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto merchant-venues (ADR-029). Solo este contexto usa sus tablas. */
export const venuesSchema = pgSchema('venues');

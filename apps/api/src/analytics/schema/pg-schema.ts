import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto analytics (ADR-029). Solo este contexto usa sus tablas. */
export const analyticsSchema = pgSchema('analytics');

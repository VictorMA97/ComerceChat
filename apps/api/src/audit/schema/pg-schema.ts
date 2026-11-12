import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto audit (ADR-029). Solo este contexto usa sus tablas. */
export const auditSchema = pgSchema('audit');

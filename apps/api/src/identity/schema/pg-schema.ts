import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto identity (ADR-029). Solo este contexto usa sus tablas. */
export const identitySchema = pgSchema('identity');

import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto fake-pos (ADR-029). Solo este contexto usa sus tablas. */
export const fakePosSchema = pgSchema('fake_pos');

import { pgSchema } from 'drizzle-orm/pg-core';

/** Esquema de Postgres del contexto fake-psp (ADR-029). Solo este contexto usa sus tablas. */
export const fakePspSchema = pgSchema('fake_psp');

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;
/** Tipo de una transacción de Drizzle, para servicios que reciben `tx`. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export function createDatabase(url: string): { db: Database; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

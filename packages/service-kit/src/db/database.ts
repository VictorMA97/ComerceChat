import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Conexión de Drizzle tal como la usa este paquete: sin el esquema de la aplicación, que cada servicio
 * pasa al crearla. El paquete solo usa el constructor de consultas (`select`, `insert`…).
 */
export type Database = NodePgDatabase<Record<string, unknown>>;
/** Transacción de Drizzle, para métodos que reciben `tx`. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Tokens de inyección de la conexión (Drizzle) y del pool de `pg`. */
export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

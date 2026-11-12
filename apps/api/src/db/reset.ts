// Borra la base de datos local entera: los esquemas de los contextos, `public` y el historial de
// migraciones. Hace falta una vez tras F1.6, que sustituyó las migraciones de la PoC por una línea
// base con un esquema por contexto (ADR-029). Uso: pnpm db:reset (migra y carga el seed después).
import { loadEnv } from '../config/env.js';
import { createDatabase } from './client.js';

const env = loadEnv();
if (env.NODE_ENV === 'production') {
  throw new Error('db:reset borra todos los datos: no se puede ejecutar con NODE_ENV=production');
}
const SCHEMAS = [
  'drizzle',
  'platform',
  'identity',
  'venues',
  'payments',
  'loyalty',
  'audit',
  'analytics',
  'fake_pos',
  'fake_psp',
];
const { pool } = createDatabase(env.DATABASE_URL);
try {
  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMAS.join(', ')} CASCADE`);
  // Las tablas de la PoC anterior a F1.6 y PostGIS estaban en `public`.
  await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
  await pool.query('CREATE SCHEMA public');
  console.log('Base de datos local vacía.');
} finally {
  await pool.end();
}

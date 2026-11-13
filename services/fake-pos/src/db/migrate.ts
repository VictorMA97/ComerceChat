// Aplica las migraciones del software de caja simulado (esquema fake_pos, con su propia tabla de control).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { loadEnv } from '../config/env.js';

const pool = new pg.Pool({ connectionString: loadEnv().DATABASE_URL });
try {
  await migrate(drizzle(pool), {
    migrationsFolder: join(dirname(fileURLToPath(import.meta.url)), '../../drizzle'),
    migrationsSchema: 'fake_pos',
  });
  console.log('Migraciones del software de caja simulado aplicadas.');
} finally {
  await pool.end();
}

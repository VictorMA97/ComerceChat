// Aplica las migraciones del PSP simulado (esquema fake_psp, con su propia tabla de control).
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
    migrationsSchema: 'fake_psp',
  });
  console.log('Migraciones del PSP simulado aplicadas.');
} finally {
  await pool.end();
}

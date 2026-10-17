// Aplica las migraciones SQL de ./drizzle. Uso: pnpm db:migrate
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadEnv } from '../config/env.js';
import { createDatabase } from './client.js';

const { db, pool } = createDatabase(loadEnv().DATABASE_URL);
const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

try {
  await migrate(db, { migrationsFolder });
  console.log('Migraciones aplicadas.');
} finally {
  await pool.end();
}

import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/config/env.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: loadEnv().DATABASE_URL },
  migrations: { schema: 'fake_psp' },
  strict: true,
  verbose: true,
});

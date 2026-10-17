import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/config/env.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url: loadEnv().DATABASE_URL },
  // PostGIS crea tablas propias (spatial_ref_sys); no deben aparecer en las migraciones.
  extensionsFilters: ['postgis'],
  strict: true,
  verbose: true,
});

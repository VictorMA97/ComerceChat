import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type pg from 'pg';
import { ENV, type Env } from '../config/env.js';
import { createDatabase, DB, PG_POOL } from './client.js';

const DB_HANDLE = Symbol('DB_HANDLE');

@Global()
@Module({
  providers: [
    { provide: DB_HANDLE, inject: [ENV], useFactory: (env: Env) => createDatabase(env.DATABASE_URL) },
    { provide: DB, inject: [DB_HANDLE], useFactory: (h: ReturnType<typeof createDatabase>) => h.db },
    { provide: PG_POOL, inject: [DB_HANDLE], useFactory: (h: ReturnType<typeof createDatabase>) => h.pool },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

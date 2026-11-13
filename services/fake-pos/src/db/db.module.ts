import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { DB, PG_POOL } from '@comercechat/service-kit/db';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { ENV, type Env } from '../config/env.js';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;
export { DB };

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env) => new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 }),
    },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: pg.Pool) => drizzle(pool, { schema }) },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

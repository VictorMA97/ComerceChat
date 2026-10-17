import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { DB, type Database } from '../db/client.js';
import { REDIS } from '../redis/redis.module.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado de la API y sus dependencias' })
  async check(@Res({ passthrough: true }) res: Response) {
    const [postgres, redis] = await Promise.all([
      this.db.execute(sql`select 1`).then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
      this.redis.ping().then(
        () => 'ok' as const,
        () => 'down' as const,
      ),
    ]);
    const status = postgres === 'ok' && redis === 'ok' ? 'ok' : 'degraded';
    if (status !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status, postgres, redis };
  }
}

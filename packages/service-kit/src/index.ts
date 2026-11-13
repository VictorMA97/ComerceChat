// Núcleo común de los servicios de ComerceChat (ADR-029, MIGRACION §3.2). Sin Nest, por separado:
// `@comercechat/service-kit/config` (configuración base), `/db` (columnas y tablas de platform) y
// `/telemetry` (se arranca antes de importar nada más, ADR-027).
import 'reflect-metadata';

export * from './common/app-error.js';
export * from './common/bearer.js';
export * from './common/ids.js';
export * from './common/money.js';
export * from './common/pii.js';
export * from './common/safe-error.js';
export * from './config/base-env.js';
export * from './db/index.js';
export * from './http/bootstrap.js';
export * from './http/client-ip.js';
export * from './http/health.controller.js';
export * from './http/internal-auth.guard.js';
export * from './http/internal-client.js';
export * from './http/problem.filter.js';
export * from './http/throttling.js';
export * from './idempotency/idempotency.module.js';
export * from './idempotency/idempotency.service.js';
export * from './outbox/audit-emitter.js';
export * from './outbox/outbox-relay.service.js';
export * from './outbox/outbox.module.js';
export * from './outbox/outbox.service.js';
export * from './queue/bullmq.transport.js';
export * from './queue/queue.module.js';
export * from './queue/queue.service.js';
export * from './queue/queue.types.js';
export * from './queue/sqs.transport.js';
export * from './queue/trace-context.js';
export * from './realtime/realtime-publisher.js';
export * from './redis/redis.module.js';

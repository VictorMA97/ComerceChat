# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Monorepo pnpm + Turborepo. **PoC local completa:** hitos P1–P4 (`docs/ROADMAP.md` §2). Hay API (NestJS), web QR y panel (Next.js): pago simulado de una mesa entera o dividida (partes iguales, por platos, por importe), cobro con QR generado desde la caja para cada mesa (ADR-023), vista de sala, tiempo real, alta del comensal con código, puntos, cupones y analítica (ADR-024). Recorrido manual en `docs/DEMO.md`. **M0 en curso** (ROADMAP §3): hechos el registro de comercios con doble factor TOTP (ADR-025), colas en SQS (ADR-026), trazas OpenTelemetry (ADR-027), auditoría de solo inserción con registro de actividad (ADR-028) y el STRIDE del pago; falta Sentry (requiere cuenta) y la prueba de D-03. **Migración a microservicios en curso** (hito MS, ADR-029/030, `docs/MIGRACION.md`): F0 hecha; hasta F6 el backend sigue en `apps/api`. El trabajo funcional está parado hasta terminarla. Comentarios, documentación y textos de UI en español.

## Comandos

- Todo: `pnpm poc:up` (Docker + `.env.local` + migraciones + seed + dev). Requiere Docker.
- `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` (Turborepo, todo el monorepo).
- Tests: `pnpm test:unit` (sin Docker, cacheado; lo ejecuta el hook `pre-push` junto a `lint` y `typecheck`) y `pnpm test:integration` (Postgres/Redis). El `pre-commit` pasa ESLint + Prettier con lint-staged.
- Un solo test: `pnpm --filter @comercechat/api exec vitest run src/common/qr-signature.spec.ts` (o `-t "nombre del test"`).
- Los E2E de la API (`apps/api/test/*.e2e-spec.ts`) usan Postgres, Redis y ElasticMQ (SQS) reales de docker compose; crean sus propios datos con emails únicos.
- Migraciones: edita las tablas del contexto en `apps/api/src/<contexto>/schema/*` (`src/db/schema/index.ts` solo las junta), ejecuta `pnpm db:generate`, **revisa el SQL** en `apps/api/drizzle/` (ver ADR-019: hay que corregir a mano el tipo `geography`) y aplica con `pnpm db:migrate`.
- `pnpm db:seed` borra y recrea los datos de prueba.
- `pnpm e2e`: recorrido completo en navegador (Playwright, `e2e/`); recarga los datos y fija `WEB_QR_BASE_URL` a localhost durante la prueba.
- `pnpm poc:stop`: libera los puertos 3000/3001/4000 si `pnpm dev` dejó procesos huérfanos. No uses `pkill -f` con patrones que aparezcan en tu propio comando.
- `pnpm poc:totp`: código actual del doble factor de los OWNER del seed (secreto de prueba `JBSWY3DPEHPK3PXP`). En los E2E de la API, entra al panel con `merchantLogin` de `apps/api/test/merchant-session.ts` (el mismo código TOTP no vale dos veces: un login por usuario y test).

## Particularidades del stack (ADR-020)

- La API es **ESM**: los imports relativos llevan extensión `.js` (`import { x } from './x.js'`). NestJS 12 es solo ESM.
- Next.js 16: `cookies()`, `headers()` y `params` son asíncronos; `middleware` se llama `proxy`. Antes de usar una API de Next, consulta `node_modules/next/dist/docs/`.
- TypeScript fijado a `~5.9` (el CLI de Nest no soporta TS 7).
- Variables de entorno: un único `.env.local` en la raíz (generado por `pnpm poc:keys`), validado con zod en `apps/api/src/config/env.ts`. Las apps Next lo cargan en `next.config.ts`.
- Errores de la API: lanza `AppError(code, status, title)`; `ProblemFilter` lo convierte en RFC 9457.
- Asíncrono: `QueueService` es una fachada (ADR-026): `add`/`addBulk` con `{ jobId, attempts, backoffMs, delayMs }`, `registerWorker` y `schedule` para tareas periódicas. `QUEUE_DRIVER=bullmq|sqs` elige el transporte de las colas de trabajo; las de `SCHEDULED_QUEUES` van siempre en BullMQ. No uses BullMQ directamente. Los workers solo arrancan si `PROCESS_ROLE` ≠ `http`. Los eventos de dominio están en `apps/api/src/contracts/events.ts` (tipos versionados `Nombre.v1`, sus datos y quién los recibe en `SUBSCRIPTIONS`). Se escriben con `OutboxService.enqueue(tx, …)` dentro de la transacción y se consumen con `OutboxRelayService.on(consumidor, tipo, handler)`; cada contexto consumidor tiene su cola (`domain-events-<contexto>`) y los handlers deben ser idempotentes (con SQS no hay deduplicación por `jobId`). Llevan los datos que necesita el consumidor: no leas tablas de otro contexto en un handler.
- Auditoría: `AuditEmitter.record({ …, merchantId }, tx)` (en `outbox/`): escribe `AuditRecorded.v1` en el outbox dentro de la transacción y el contexto `audit` lo inserta en `audit_logs` poco después (ADR-029). Pasa siempre `merchantId` si la acción es de un comercio, para que aparezca en su registro de actividad. `audit_logs` y `user_consents` rechazan UPDATE/DELETE en la base de datos (ADR-028).
- Telemetría: `main.ts` arranca OpenTelemetry y luego importa `server.ts` de forma dinámica; no añadas imports estáticos de la app en `main.ts` o dejarán de instrumentarse. Nada de tokens ni datos personales en atributos de spans (ADR-027).
- El navegador del comensal nunca llama a la API: `apps/web-qr` la consulta desde el servidor (ADR-021).
- Dividir la cuenta: toda reserva de una parte pasa por `order_allocations` con el pedido bloqueado (`TableBillService.lockOrderMirror` + `computeState` en la misma transacción). No calcules lo disponible fuera de esa transacción para decidir un cobro (ADR-022).
- Tiempo real: tras un cambio relevante llama a `RealtimeService.publishTable(...)` / `publish(...)` después del commit. Los navegadores escuchan con `LiveRefresh` (SSE con caída a sondeo).

ComerceChat es un producto de *pedir, pagar y volver* para restaurantes con servicio en mesa en Madrid: web QR sin instalación (ver cuenta, pedir, dividir, propina, pagar), puntos y cupones del propio comercio, y panel con CRM. **No es una superapp** (ADR-001).

## Mapa de documentos

| Documento | Para qué consultarlo |
|---|---|
| `docs/SPEC.md` | Requisitos con IDs estables: `REG-xx` (regulatorios), `FR-<ÁREA>-xx` (funcionales), `NFR-xx`; recorridos de usuario y máquinas de estado (§7) |
| `docs/ARCHITECTURE.md` | Stack, estructura del monorepo, módulos del backend, interfaces de proveedores, flujo de pago, diseño de QR, modelo de datos (§10), API |
| `docs/DECISIONS.md` | ADRs aceptados (`ADR-xxx`) y decisiones abiertas (`D-xx`) con su criterio de desbloqueo |
| `docs/ROADMAP.md` | Fases, hitos de la PoC (P1–P4) y del MVP (M0–M5) con su condición de "hecho" y criterios técnicos de salida |
| `docs/DEMO.md` | Recorrido manual de la PoC paso a paso y resolución de problemas |
| `docs/STRIDE.md` | Modelo de amenazas del flujo de pago: mitigaciones con su test y riesgos abiertos por hito |
| `docs/MIGRACION.md` | Plan de migración a microservicios (hito MS): servicios, datos, contratos, fases F0–F7 y recomendaciones DevOps |

Convenciones de la documentación:
- Etiquetas `[HECHO]`, `[HIPÓTESIS]`, `[INCIERTO]` en afirmaciones y cifras; mantenlas al editar.
- Los documentos se enlazan entre sí por ID (`ADR-003`, `FR-PAY-05`, `D-01`) y anclas `<a id="adr-001">`. Si cambias un ID o una decisión, actualiza las referencias cruzadas en todos los documentos.
- Las decisiones nuevas se añaden como ADR con contexto, decisión, alternativas descartadas, consecuencias y estado. Una decisión que cambia otra se marca `Sustituida por ADR-XXX`, no se borra.
- `docs/` es solo documentación técnica. El análisis de negocio está en `negocio/` y no se enlaza desde `docs/`.
- Toda función nueva entra por un hito del ROADMAP, con sus requisitos en SPEC (ADR-001).

## Arquitectura prevista

TypeScript de punta a punta en un monorepo pnpm + Turborepo (ADR-008):
- `apps/api`: NestJS, hoy **monolito modular**. El mismo código corre como proceso HTTP o como worker según una variable de entorno. Se está partiendo en microservicios en `services/*` (ADR-029, sustituye a ADR-009): `table-payments` (pago, cuenta, reparto, QR dinámico y cupones, con transacción ACID) no se parte; un esquema y un rol de Postgres por servicio; REST `/internal/*` entre servicios y eventos por outbox con una cola por consumidor. Ver `docs/MIGRACION.md`.
- `apps/web-qr` (Next.js, `pay.<dominio>`): el producto principal; presupuesto estricto de rendimiento (NFR-01: < 1,5 s en 4G, JS inicial < 150 KB).
- `apps/merchant-panel` (Next.js; incluye el backoffice en `/admin`), `apps/mobile` (Expo, secundaria).
- `packages/shared-types` (enums y contratos de la API) y `packages/api-client` (cliente HTTP de servidor de las apps Next: todo fallo llega como `ApiError` con un problem RFC 9457 válido, con timeout; usa `lib/api.ts` de cada app, no `fetch` directo). Previstos: cliente generado desde el OpenAPI de NestJS en `api-client`, `packages/ui`, `packages/config`.
- PostgreSQL 16 + PostGIS, Redis (estado de mesa, bloqueos, nonces, pub/sub), SQS, S3. Despliegue del MVP en Kubernetes local con k3d y nginx como gateway (ADR-030, sustituye a ADR-011); la nube está sin elegir (D-07). Lo DevOps más allá de desplegar en k3d son recomendaciones (`docs/MIGRACION.md` §9), no parte de la migración.

Reglas entre módulos del backend: cada carpeta de `apps/api/src` en `CONTEXTS` (`.dependency-cruiser.cjs`) es un futuro servicio. Un contexto solo importa de otro lo que este expone en `src/<contexto>/public/`, y nunca sus tablas (`src/<contexto>/schema/`); el código compartido (`common`, `config`, `db`, `queue`, `outbox`…) no importa contextos. `pnpm lint` lo comprueba con dependency-cruiser; las violaciones pendientes de F1 están en `.dependency-cruiser-known-violations.json` y no se añaden nuevas. Los eventos de dominio se publican con patrón **outbox** (`outbox_events` → worker → SQS).

Los proveedores externos van detrás de interfaces: `PaymentProvider` (PSP) y `PosConnector` (software de caja, con `ManualPosConnector` como modo degradado). El PSP y el software de caja concretos aún no están elegidos (D-01, D-02); no acoples código a un proveedor fuera de su adaptador.

## Invariantes que no se pueden romper

Romper estas reglas cambia el estatus regulatorio de la empresa o permite cobrar dos veces (SPEC §4, ADR-003/004/006/012/015):
- El dinero nunca pasa por cuentas de ComerceChat; solo comisión de plataforma descontada por el PSP. Sin monedero, saldo, envíos entre usuarios ni cashback en dinero.
- Los datos de tarjeta nunca tocan nuestros servidores: solo componentes alojados del PSP (PCI SAQ A).
- No se emiten tickets ni facturas; solo "Justificante de pago, no válido como factura" (VeriFactu).
- Un pago pasa a `CAPTURED` **solo** por webhook firmado del PSP, nunca por la redirección del navegador. Webhooks: firma sobre el cuerpo en bruto, deduplicación por `psp_event_id`, responder 200 y procesar en el worker.
- `Idempotency-Key` obligatoria en todo POST que cree pagos, reembolsos, canjes o campañas.
- Los puntos solo se crean desde el procesamiento de webhooks (nunca hay endpoint de cliente para añadirlos). `points_ledger_entries` es de solo-inserción: las correcciones son entradas `REVERSE`/`ADJUST`; `EARN` nace `PENDING`. Los puntos no se compran ni se canjean por dinero, y en el MVP cada programa pertenece a un único comercio.
- Canje de cupones atómico (`UPDATE … WHERE status='ACTIVE' RETURNING`, `UNIQUE(coupon_redemptions.coupon_id)`).
- El CRM del comercio solo muestra usuarios cuyo último `user_consents(SHARE_WITH_MERCHANT, merchant_id)` es `granted`. Los consentimientos son de solo-inserción y versionados.
- Si falla registrar el pago en el software de caja, se reintenta y se avisa al STAFF; el pago **no** se revierte.

Convenciones del modelo de datos: ids UUIDv7, importes en `*_cents BIGINT` + `currency`, `status` como enum de Postgres, errores de API en RFC 9457 con `code` estable, paginación por cursor, textos externalizados (ES/EN) desde el día 1.

## PoC local (primera fase de desarrollo)

El primer código es una PoC que corre entera en local (SPEC §3.3, ARCHITECTURE §16, ADR-017/018). Usa el mismo monorepo y stack que el MVP, no es desechable. Los proveedores externos se sustituyen por simuladores seleccionados por variables de entorno detrás de las mismas interfaces:
- `PAYMENT_PROVIDER=fake|stripe`
- `POS_CONNECTOR=fake|manual`
- `OTP_SENDER=console`
- `QUEUE_DRIVER=bullmq`
- `STORAGE_DRIVER=local`
- `AUTH_PROVIDER=local`

Los simuladores viven en `apps/api/src/fake-psp/` y `apps/api/src/fake-pos/`; el adaptador del PSP simulado, en `apps/api/src/table-payments/payments/providers/`. El arranque debe fallar con `NODE_ENV=production` si algún selector vale `fake` o `console`. `FakePaymentProvider` envía webhooks firmados por el mismo camino que el PSP real: no hay atajos que marquen pagos como capturados sin pasar por el webhook. Las invariantes de arriba aplican también a la PoC.

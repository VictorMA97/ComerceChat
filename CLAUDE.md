# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Monorepo pnpm + Turborepo con la **PoC local** en curso: hitos P1, P2 y P3 completados (`docs/ROADMAP.md` §2). Hay API (NestJS), web QR y panel (Next.js): pago simulado de una mesa entera o dividida (partes iguales, por platos, por importe), cobro con QR generado desde la caja para cada mesa (ADR-023), vista de sala y tiempo real. Siguiente: P4 (usuarios, puntos, cupones). Comentarios, documentación y textos de UI en español.

## Comandos

- Todo: `pnpm poc:up` (Docker + `.env.local` + migraciones + seed + dev). Requiere Docker.
- `pnpm dev` · `pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` (Turborepo, todo el monorepo).
- Un solo test: `pnpm --filter @comercechat/api exec vitest run src/qr/qr-signature.spec.ts` (o `-t "nombre del test"`).
- Los E2E de la API (`apps/api/test/*.e2e-spec.ts`) usan Postgres y Redis reales de `.env.local`; crean sus propios datos con emails únicos.
- Migraciones: edita `apps/api/src/db/schema/*`, ejecuta `pnpm db:generate`, **revisa el SQL** en `apps/api/drizzle/` (ver ADR-019: hay que corregir a mano el tipo `geography`) y aplica con `pnpm db:migrate`.
- `pnpm db:seed` borra y recrea los datos de prueba.

## Particularidades del stack (ADR-020)

- La API es **ESM**: los imports relativos llevan extensión `.js` (`import { x } from './x.js'`). NestJS 12 es solo ESM.
- Next.js 16: `cookies()`, `headers()` y `params` son asíncronos; `middleware` se llama `proxy`. Antes de usar una API de Next, consulta `node_modules/next/dist/docs/`.
- TypeScript fijado a `~5.9` (el CLI de Nest no soporta TS 7).
- Variables de entorno: un único `.env.local` en la raíz (generado por `pnpm poc:keys`), validado con zod en `apps/api/src/config/env.ts`. Las apps Next lo cargan en `next.config.ts`.
- Errores de la API: lanza `AppError(code, status, title)`; `ProblemFilter` lo convierte en RFC 9457.
- Asíncrono: `QueueService` (BullMQ) registra workers que solo arrancan si `PROCESS_ROLE` ≠ `http`. Los eventos de dominio se escriben con `OutboxService.enqueue(tx, …)` dentro de la transacción y se consumen con `OutboxRelayService.on(tipo, handler)`; los handlers deben ser idempotentes.
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
| `docs/ROADMAP.md` | Fases, hitos de la PoC (P1–P4) y del MVP (M0–M5) con su condición de "hecho", KPIs de salida |
| `docs/CONTEXT.md` | Negocio, mercado y regulación (resumen) |
| `docs/ANALISIS_PROYECTO.md` | Fuente detallada de la que derivan los demás, con cifras y fuentes |

Convenciones de la documentación:
- Etiquetas `[HECHO]`, `[HIPÓTESIS]`, `[INCIERTO]` en afirmaciones y cifras; mantenlas al editar.
- Los documentos se enlazan entre sí por ID (`ADR-003`, `FR-PAY-05`, `D-01`) y anclas `<a id="adr-001">`. Si cambias un ID o una decisión, actualiza las referencias cruzadas en todos los documentos.
- Las decisiones nuevas se añaden como ADR con contexto, decisión, alternativas descartadas, consecuencias y estado. Una decisión que cambia otra se marca `Sustituida por ADR-XXX`, no se borra.
- Toda función nueva debe justificar su impacto en un KPI de salida de la fase en curso (ADR-001).

## Arquitectura prevista

TypeScript de punta a punta en un monorepo pnpm + Turborepo (ADR-008):
- `apps/api`: NestJS, **monolito modular** (ADR-009). El mismo código corre como proceso HTTP o como worker según una variable de entorno.
- `apps/web-qr` (Next.js, `pay.<dominio>`): el producto principal; presupuesto estricto de rendimiento (NFR-01: < 1,5 s en 4G, JS inicial < 150 KB).
- `apps/merchant-panel` (Next.js; incluye el backoffice en `/admin`), `apps/mobile` (Expo, secundaria).
- `packages/shared-types` (enums y contratos de la API). Previstos: `packages/api-client` (generado desde el OpenAPI de NestJS), `packages/ui`, `packages/config`.
- PostgreSQL 16 + PostGIS, Redis (estado de mesa, bloqueos, nonces, pub/sub), SQS, S3. AWS eu-south-2, Terraform, ECS Fargate.

Reglas entre módulos del backend: un módulo solo accede a datos de otro a través de su servicio público (nada de joins entre tablas de módulos distintos, salvo vistas de `analytics` sobre la réplica). Los eventos de dominio se publican con patrón **outbox** (`outbox_events` → worker → SQS).

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

Los simuladores viven en `apps/api/src/<módulo>/providers/fake-*.ts`. El arranque debe fallar con `NODE_ENV=production` si algún selector vale `fake` o `console`. `FakePaymentProvider` envía webhooks firmados por el mismo camino que el PSP real: no hay atajos que marquen pagos como capturados sin pasar por el webhook. Las invariantes de arriba aplican también a la PoC.

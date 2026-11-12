# MIGRACIÓN: del monolito modular a microservicios

> **Estado:** v0.3 (12-nov-2026). Aprobado; decisiones en [ADR-029](DECISIONS.md#adr-029) y [ADR-030](DECISIONS.md#adr-030). **F0 hecha**; la siguiente fase es F1.
> **Documentos relacionados:** [ARCHITECTURE.md](ARCHITECTURE.md) · [DECISIONS.md](DECISIONS.md) · [ROADMAP.md](ROADMAP.md) · [STRIDE.md](STRIDE.md)
>
> Las afirmaciones sobre el código actual llevan `[HECHO]` (comprobadas en el repositorio a fecha de este documento). Las estimaciones y elecciones de diseño de este plan, `[HIPÓTESIS]`.

---

## 1. Contexto y decisiones de partida

[ADR-009](DECISIONS.md#adr-009) eligió un monolito modular y descartó los microservicios por el coste operativo con un equipo pequeño. Esta migración la sustituye por otro motivo: **el proyecto es un portfolio** y se quiere una base de microservicios sobre la que hacer experimentos de DevOps.

Decisiones tomadas con el propietario del proyecto (12-nov-2026):

| # | Decisión |
|---|---|
| 1 | Motivo: portfolio y base para experimentos DevOps. **Este plan no incluye trabajo DevOps** (CI/CD, Terraform, Helm, GitOps, malla de servicios…): solo lo mínimo para desplegar, y el resto como recomendaciones ([§9](#recomendaciones-devops)) |
| 2 | Se mantiene el **monorepo** pnpm + Turborepo, con servicios que se construyen y despliegan por separado |
| 3 | **`table-payments`** es un único servicio con transacción ACID: pago, cuenta de la mesa, reparto, QR dinámico y ciclo de vida del cupón. No hay sagas en el camino del dinero |
| 4 | **Un clúster PostgreSQL**: una base de datos, un esquema y un rol por servicio |
| 5 | Comunicación síncrona **REST/JSON** (como hoy) y asíncrona con eventos por cola (outbox) |
| 6 | Objetivo de despliegue: **Kubernetes local con k3d** (además de `pnpm dev` y docker compose) |
| 7 | Se hace **antes de M1** y el trabajo funcional se para mientras dura |
| 8 | Primero se aprueba el plan y después se ejecuta |
| 9 | El **gateway es nginx** (configuración declarativa, sin código propio) |
| 10 | **El MVP se despliega en Kubernetes local (k3d)**, no en ECS Fargate. [ADR-011](DECISIONS.md#adr-011) se sustituye entera por ADR-030; el proveedor de nube, la región y el CDN/WAF pasan a la decisión abierta [D-07](DECISIONS.md#d-07). Desplegar en la nube pasa a ser una recomendación ([§9](#recomendaciones-devops)) |

**Restricciones que no cambian** (CLAUDE.md, SPEC §4): todas las invariantes de dinero, puntos, cupones, consentimientos y auditoría; ESM con extensión `.js`; el navegador no llama nunca a la API (ADR-021); errores RFC 9457; textos y comentarios en español.

## 2. Diagnóstico del código actual

### 2.1 Tamaño y forma `[HECHO]`

- `apps/api`: NestJS 12, unas 9.400 líneas sin tests, 17 módulos, 30 tablas en el esquema `public` y 6 migraciones (`0000`–`0005`).
- Las apps Next (`web-qr`, `merchant-panel`) hacen de BFF y llaman a la API con un único `API_BASE_URL`, mediante `packages/api-client`.
- Hay un proceso con `PROCESS_ROLE=all|http|worker`; workers BullMQ/SQS y el relé del outbox corren en el mismo código.

### 2.2 Lo que ya ayuda `[HECHO]`

- Outbox (`outbox_events`), relé y procesadores idempotentes; `QueueService` con transportes BullMQ y SQS (ADR-026).
- `PaymentProvider` y `PosConnector` como interfaces, con simuladores.
- OpenTelemetry con HTTP, Postgres, Redis y colas (ADR-027).
- Tests E2E de la API contra Postgres, Redis y ElasticMQ reales, y un E2E de Playwright.

### 2.3 Lo que hay que resolver `[HECHO]`

1. **Accesos cruzados a tablas** (la regla de ARCHITECTURE §5 no se cumple):
   - `payments` → `coupons`, `qr_codes`, `points_ledger_entries`, `orders`, `tables`, `merchants`, `users`.
   - `tables` → `payments` (suma de lo cobrado sin registrar, `tables/table-bill.service.ts:176`), `coupons`.
   - `loyalty` → `payments` (bloqueo y `UPDATE payments SET user_id` al reclamar puntos, `loyalty/loyalty.service.ts:137`), `merchants`.
   - `analytics` → `payments`. `qr` → `payments`, `merchants`. `pos` → `payments`, `tables`, `merchant_locations`.
   - No existe la verificación de dependencias en CI que prevé ADR-009.
2. **Claves foráneas entre dominios**:
   - `coupons.reserved_payment_id`, `coupon_redemptions.payment_id` y `points_ledger_entries.payment_id` → `payments`.
   - `payments` → `orders`, `tables`, `qr_codes`, `users`, `merchants`, `merchant_locations`.
   - `loyalty_*`, `user_consents` → `merchants`, `users`. `qr_codes.created_by` → `merchant_users`.
3. **Dos transacciones que sostienen las invariantes de dinero**:
   - Crear la sesión de pago (`payments/payments.service.ts:139` y `:198`): pedido espejo bloqueado, asignaciones, reserva del cupón y bloqueo del QR dinámico.
   - Capturar (`payments/payment-events.service.ts:104`): pago `CAPTURED`, asignaciones `PAID`, canje del cupón, QR `CONSUMED`, `transactions`, auditoría y outbox.
   → Las dos quedan enteras dentro de `table-payments` (decisión 3).
4. **La sesión del comercio se valida contra la BD** en cada petición (`auth/auth.service.ts:129`): rol, estado y doble factor se leen de `merchant_users`. La del comensal comprueba `users.status` (`users/user-auth.ts`). Los JWT son HS256 con un `JWT_SECRET` compartido.
5. **Auditoría dentro de la transacción** (`AuditService.record(…, tx)`) desde `auth`, `merchants`, `venues`, `qr`, `payments` y `loyalty`.
6. **Un solo destino de eventos**: el relé publica todo en la cola `domain-events` y los manejadores se registran en el mismo proceso (`OutboxRelayService.on`). Eventos actuales: `PaymentCaptured` (lo consumen `loyalty` y `pos-sync`) y `QrRevoked`. El payload de `PaymentCaptured` solo lleva `paymentId`, y los consumidores leen `payments` directamente.
7. **Prefijos de ruta compartidos entre módulos**: `qr/*` lo sirven `qr` y `tables`; `merchant/*` lo sirven `merchants`, `tables`, `qr`… El enrutado del gateway tiene que ser por ruta concreta, no por prefijo de módulo.
8. **El seed** (`db/seed.ts`) escribe en todas las tablas a la vez.
9. **Hallazgo previo, ajeno a la migración:** `POST /me/rewards/:id/redeem` (un canje) no exigía `Idempotency-Key`, contra la invariante de CLAUDE.md. Se corrige aparte, fuera del hito MS: `IdempotencyService` pasa a `common/` y lo usan `payments` y `loyalty` (ARCHITECTURE §11). Al separar servicios, `loyalty` necesitará su propia tabla `idempotency_keys` en su esquema.

<a id="arquitectura-objetivo"></a>
## 3. Arquitectura objetivo

```
 navegador ─► web-qr (BFF) ──┐                         ┌─► identity          (esquema identity)
 navegador ─► merchant-panel ┤                         ├─► merchant-venues   (esquema venues)
                (BFF)        └─► nginx :4000 ──────────┼─► table-payments    (esquema payments)
 PSP / simulador ─ webhooks ─►   (REST /v1, sin CORS)  ├─► loyalty           (esquema loyalty)
                                                       ├─► realtime (SSE)    (sin tablas)
                                                       ├─► audit             (esquema audit)
                                                       ├─► analytics         (esquema analytics)
                                                       ├─► fake-psp          (esquema fake_psp)   ← simulador
                                                       └─► fake-pos          (esquema fake_pos)   ← simulador

 Entre servicios: REST /internal/* (no enrutado por el gateway) · eventos: outbox de cada servicio → cola por consumidor
 Compartido: PostgreSQL 16 + PostGIS (un clúster, un esquema y un rol por servicio) · Redis (prefijo por servicio) · SQS/BullMQ
```

<a id="servicios"></a>
### 3.1 Servicios y lo que poseen `[HIPÓTESIS]`

| Servicio | Origen en `apps/api` | Tablas (esquema propio) | Rutas públicas `/v1` |
|---|---|---|---|
| **gateway** (nginx) | nuevo: `deploy/gateway/nginx.conf` | — | todas: enruta por ruta concreta (`location` exactas o con regex, por los prefijos compartidos de [§2.3](#23-lo-que-hay-que-resolver-hecho)), deja pasar sin tocar las cabeceras de IP que reenvían los BFF (ADR-021) y `traceparent`, y no expone `/internal/*` |
| **identity** | `auth`, `users` (OTP, sesión, consentimientos), `token-revocation` | `merchant_users`, `merchant_user_recovery_codes`, `users`, `user_consents` | `merchant/auth/*` (login, MFA, logout), `auth/otp/*`, `auth/logout`, `me`, `me/consents` |
| **merchant-venues** | `merchants`, `venues`, `qr` (estáticos) | `merchants`, `merchant_locations`, `tables`, `qr_codes` (solo estáticos), `pos_integrations` cuando exista | `merchant/auth/register`, `merchant/me`, `merchant/psp/onboarding/simulate`, `merchant/locations/*`, `merchant/tables/:id/qr/regenerate`, `qr/:code` |
| **table-payments** | `payments`, `tables` (cuenta, sala), QR dinámico, `pos-sync`, cupones (reserva, canje, listado) | `orders`, `order_items`, `order_allocations`, `payments`, `transactions`, `psp_webhook_events`, `idempotency_keys`, `payment_qr_codes` (QR dinámicos), `coupons`, `coupon_redemptions` | `qr/:code/bill`, `payment-sessions`, `payments/*`, `webhooks/psp/:provider`, `merchant/tables/:id/payment-qr`, `merchant/dynamic-qr/*`, `qr/dynamic/*`, `merchant/floor`, `me/coupons` |
| **loyalty** | `loyalty` (programas, puntos, recompensas, promociones) | `loyalty_programs`, `loyalty_rewards`, `loyalty_accounts`, `points_ledger_entries`, `promotions`, `idempotency_keys` | `me/loyalty`, `me/rewards/:id/redeem`, `me/claim`, `merchant/promotions/*` |
| **realtime** | `realtime` + rutas `@Sse` de `tables` | — (Redis pub/sub) | `qr/:code/events`, `merchant/events` |
| **audit** | `audit` + `merchants/audit.controller` | `audit_logs` (con los triggers de ADR-028) | `merchant/audit` |
| **analytics** | `analytics` | modelo de lectura `payment_facts` alimentado por eventos | `merchant/analytics/*` |
| **fake-psp** | `payments/fake-psp` | `fake_psp_sessions` | `fake-psp/sessions/*` |
| **fake-pos** | `pos/fake-pos.*` | `fake_pos_*` | `merchant/fake-pos/*` |

Notas de diseño:
- **Cupones en `table-payments`.** Es consecuencia de la decisión 3: la reserva y el canje tienen que ir en la misma transacción que el pago (FR-CPN-06, `UNIQUE(coupon_redemptions.coupon_id)`). `loyalty` decide *cuándo* se emite un cupón (recompensa, «Vuelve y te invitamos») y lo pide a `table-payments` por `POST /internal/coupons`, idempotente por una clave de origen (`source_ref`). Las promociones y sus reglas siguen en `loyalty`, que recibe `CouponRedeemed` para sus contadores.
- **QR dinámicos separados de los estáticos.** `qr_codes` se parte por tipo: los estáticos (`STATIC_*`) en `merchant-venues` y los dinámicos (`DYNAMIC_AMOUNT`) en `payment_qr_codes` de `table-payments`, porque la captura los bloquea y consume en su transacción.
- **Simuladores como sistemas externos.** `FakePaymentProvider` y `FakePosConnector` pasan a ser clientes HTTP de `fake-psp` y `fake-pos`, igual que lo serán los adaptadores reales. Esto cumple también ARCHITECTURE §16.7 (tablas `fake_*` fuera de producción): en producción, sencillamente, esos servicios no se despliegan.
- **`PosConnector` como librería** (`packages/pos-connectors`), usada por `table-payments` (leer la cuenta, registrar el pago) y `merchant-venues` (`linkNewTables`). No se crea un servicio de integración con la caja hasta que D-02 lo justifique.
- **`realtime`** solo sirve SSE. Cualquier servicio publica en Redis con `RealtimePublisher` (en `service-kit`), y `realtime` resuelve el `code` del QR y la sesión del comercio llamando a `merchant-venues` e `identity`.

### 3.2 Paquetes compartidos `[HIPÓTESIS]`

| Paquete | Contenido (extraído de `apps/api/src`) |
|---|---|
| `packages/service-kit` | arranque (telemetría antes de importar la app, ADR-027), `configureApp` (prefijo, helmet, `ProblemFilter`, validación), `AppError`, base de configuración zod con `productionViolations`, cliente Drizzle por esquema, Redis con prefijo, `QueueService` + transportes, `OutboxService` + relé con tabla de enrutado, throttling, `client-ip`, `ids`, `pii`, `safe-error`, `IdempotencyService` (cada servicio con su tabla), health, `InternalAuthGuard`, cliente HTTP interno (timeout + problem RFC 9457), `AuditEmitter`, `RealtimePublisher` |
| `packages/auth-client` | `MerchantAuthGuard`, `UserAuthGuard`, `@CurrentMerchant`, `@MerchantRoles`: delegan la validación en `identity` |
| `packages/contracts` | catálogo de eventos versionados (`PaymentCaptured.v1`…), tabla de suscripciones y DTO de las rutas `/internal/*`. Lo que hoy es contrato público sigue en `packages/shared-types` |
| `packages/pos-connectors` | `PosConnector`, `ManualPosConnector`, cliente HTTP de `fake-pos` |

Estructura del monorepo resultante:

```
apps/        web-qr · merchant-panel                (sin cambios de comportamiento)
services/    identity · merchant-venues · table-payments · loyalty · realtime · audit · analytics · fake-psp · fake-pos
packages/    shared-types · api-client · service-kit · auth-client · contracts · pos-connectors
deploy/      docker/ (Dockerfile común)  ·  gateway/ (nginx.conf)  ·  k8s/ (base + overlay local)  ·  k3d/ (configuración del clúster)
e2e/         Playwright (sin cambios) + pruebas de sistema contra el gateway
```

`apps/api` desaparece al final de la migración.

### 3.3 Comunicación

**Síncrona (REST/JSON, `/internal/*`):**
- No la enruta el gateway. Se autentica con un secreto compartido en cabecera (`INTERNAL_SERVICE_SECRET`), siguiendo el patrón de `INTERNAL_PROXY_SECRET`, con timeout y errores RFC 9457.
- Llamadas previstas:

| Desde | Hacia | Para qué |
|---|---|---|
| todos los que tienen panel o comensal | `identity` `POST /internal/sessions/merchant` y `/user` | Validar la sesión con los mismos criterios que hoy (rol, estado y doble factor leídos al momento) |
| `table-payments`, `realtime` | `merchant-venues` `GET /internal/qr/:code`, `/internal/tables/:id/context` | Contexto de mesa: local, comercio, estado `ACTIVE`/`ONBOARDING`, propinas. Se mantiene la cache de 30 s (ADR-025) |
| `loyalty` | `table-payments` `POST /internal/payments/:id/claim` | Reclamar los puntos: asigna el usuario de forma atómica (`UPDATE … WHERE user_id IS NULL OR user_id = $u RETURNING`) y devuelve importes y comercio |
| `loyalty` | `table-payments` `POST /internal/coupons` | Emitir un cupón (idempotente por `source_ref`) |
| `table-payments` | `loyalty` `GET /internal/payments/:id/points` | Puntos del justificante |
| `audit` | `identity` `GET /internal/merchant-users?ids=` | Emails de los actores del registro de actividad |
| `fake-pos` | `table-payments` `GET /internal/tables/payment-qr-state` | Último QR de cada mesa en el simulador (ADR-023) |

**Asíncrona (eventos):**
- Cada servicio tiene su `outbox_events` en su esquema y su relé.
- **Una cola por consumidor** (`domain-events.<servicio>`): el relé publica cada evento en las colas suscritas según `packages/contracts`. Así varios servicios reciben el mismo evento sin SNS, también en ElasticMQ.
- Los eventos llevan el estado que necesitan los consumidores (*event-carried state transfer*) para que nadie tenga que leer tablas ajenas.

| Evento | Productor | Consumidores |
|---|---|---|
| `PaymentCaptured.v1` `{paymentId, merchantId, locationId, tableId, userId?, amountCents, discountCents, tipCents, platformFeeCents, currency, capturedAt}` | table-payments | table-payments (registro en caja), loyalty (puntos), analytics |
| `CouponRedeemed.v1` | table-payments | loyalty (contadores de promociones) |
| `QrRevoked.v1` | merchant-venues | table-payments (invalidar la cache de contexto) |
| `AuditRecorded.v1` | todos | audit |

**Auditoría:** `AuditService.record(…, tx)` pasa a ser `AuditEmitter.record(…, tx)`, que escribe un `AuditRecorded` en el outbox **dentro de la misma transacción**. La entrada sigue siendo atómica con el cambio que audita; lo que pasa a ser eventual es que aparezca en `audit_logs`. `audit` inserta de forma idempotente por el id del evento.

### 3.4 Datos

- Una base de datos `comercechat` con un esquema por servicio (`identity`, `venues`, `payments`, `loyalty`, `audit`, `analytics`, `fake_psp`, `fake_pos`). Cada servicio tiene su rol, con permisos solo sobre su esquema: la frontera la impone la base de datos, no la disciplina.
- Sin claves foráneas entre esquemas: los ids de otros servicios son columnas `uuid` sin referencia (como ya hace `audit_logs.merchant_id`, ADR-028).
- PostGIS: la extensión se crea una vez en el arranque del clúster; `merchant_locations.geo` mantiene la corrección manual de ADR-019.
- Migraciones: cada servicio tiene su `drizzle.config.ts`, su carpeta `drizzle/` y su tabla de control en su esquema (`migrationsSchema`). Como no hay datos de producción, se **rehace la línea base**: una migración inicial por servicio en lugar de mover las `0000`–`0005`. Los triggers de solo inserción de ADR-028 se mantienen en `audit.audit_logs` e `identity.user_consents`.
- Redis compartido con prefijo de claves por servicio (`<servicio>:`). Los canales de tiempo real (`rt:location:*`) son un contrato común.
- Seed: uno por servicio con ids fijos y coherentes entre servicios, más un orquestador (`pnpm db:seed`) que los ejecuta en orden. Los 14 pagos históricos se cargan también en el modelo de lectura de `analytics`.

### 3.5 Despliegue mínimo (lo único de DevOps que entra)

- `pnpm dev`: todos los servicios con Turborepo, en `:4101`–`:4109`.
- `docker compose`: la infraestructura actual (Postgres, Redis, ElasticMQ, Mailpit, Jaeger opcional) más el servicio `gateway` (nginx) en `127.0.0.1:4000`, que enruta a los servicios del host por `host.docker.internal`. `API_BASE_URL` y los BFF no cambian.
- **Configuración de nginx:** un solo `nginx.conf` con los destinos como variables, para servir igual en docker compose y en Kubernetes. En las rutas SSE (`qr/:code/events`, `merchant/events`): `proxy_buffering off` y un `proxy_read_timeout` largo. En los webhooks, el cuerpo pasa intacto, porque la firma se verifica sobre el cuerpo en bruto (ADR-015).
- Una imagen por servicio, con un Dockerfile común multietapa (`turbo prune` + `pnpm deploy`).
- **Clúster k3d** (`deploy/k3d/cluster.yaml`):
  - un servidor y un registro local de imágenes del propio k3d;
  - Traefik desactivado, porque el gateway es nginx;
  - puertos del balanceador de k3d publicados en `127.0.0.1` para `web-qr` (3000) y `merchant-panel` (3001). La API no se publica (ADR-021).
- `deploy/k8s`: manifiestos con Kustomize (base + overlay `local`):
  - por servicio, un `Deployment` HTTP y, si tiene workers, otro `Deployment` con `PROCESS_ROLE=worker`, más su `Service` y un `Job` de migración;
  - el gateway como `Deployment` de nginx con su `ConfigMap` y un `Service` interno (`ClusterIP`);
  - `web-qr` y `merchant-panel` como `Deployment` con `Service` de tipo `LoadBalancer` (el balanceador integrado de k3d);
  - infraestructura del overlay local: Postgres+PostGIS (con volumen persistente), Redis, ElasticMQ y Mailpit;
  - configuración en `ConfigMap`/`Secret` generados desde `.env.local`.
- Comandos: `pnpm k8s:up` (crea el clúster si no existe, construye y sube las imágenes, aplica el overlay y espera a las migraciones), `pnpm k8s:seed` y `pnpm k8s:down`.

## 4. Fases

Cada fase termina con la misma comprobación (**«en verde»**):
- `pnpm lint`, `pnpm typecheck`, `pnpm test:unit` y `pnpm test:integration`;
- `pnpm e2e` (Playwright);
- los criterios 2–4 de SPEC §3.3: 4 pagadores a la vez en la misma mesa, webhook ×10 → un cobro y una entrada de puntos, y 100 canjes en paralelo → 1;
- un cobro completo visible como una sola traza (a partir de F1).

Las duraciones son orientativas `[HIPÓTESIS]`.

### F0. Decisión y documentación (0,5 días) · ✅ hecha el 12-nov-2026
- ADR-029 «Microservicios dentro del monorepo, como base para experimentos DevOps»; ADR-009 pasa a `Sustituida por ADR-029`.
- ADR-030 «Despliegue del MVP en Kubernetes local (k3d) con nginx como gateway»; ADR-011 pasa entera a `Sustituida por ADR-030`.
- D-07 (nube, región y CDN/WAF) abierta.
- ROADMAP:
  - hito [MS](ROADMAP.md#ms) antes de M1;
  - M0 sin Terraform ni ECS;
  - condición de «hecho» de M0 en k3d.
- ARCHITECTURE:
  - aviso de migración en el encabezado y en §2;
  - §1 (principio 3);
  - §3 (backend, gateway, despliegue y nube);
  - §4 (`services/` y `deploy/`);
  - §5 (servicio de destino de cada módulo);
  - §14 (entornos y despliegue);
  - §16.2/§16.7.
- SPEC NFR-06, CLAUDE.md, README y STRIDE §6 (fronteras de confianza nuevas: gateway, `/internal/*` y colas entre servicios).
- **No se tocan** §5 (reglas), §10, §12, §13 ni §16 de ARCHITECTURE: describen el código actual y se reescriben en la fase que lo cambie.
- **Hecho cuando:** los documentos están aprobados y enlazados por ID.

### F1. Fronteras dentro del monolito (4–5 días)
Todo sigue en `apps/api` y desplegado como uno. Es la fase de más riesgo y la que más vale.
1. dependency-cruiser con las reglas de [§3.1](#31-servicios-y-lo-que-poseen-hipótesis): un módulo solo importa la API pública de otro.
2. Reagrupar los módulos según los servicios de destino (por ejemplo, `tables` y `payments` en `table-payments`; cupones a `table-payments`).
3. Sustituir cada acceso cruzado de [§2.3](#23-lo-que-hay-que-resolver-hecho) por una llamada a un servicio público con la misma forma que la futura ruta `/internal/*`, o por un evento.
4. Eventos con estado (`PaymentCaptured.v1` enriquecido) y relé con una cola por consumidor.
5. `AuditEmitter` por outbox.
6. Un esquema de Postgres por servicio y sin claves foráneas entre esquemas (nueva línea base de migraciones).
7. Propagar el contexto de traza en los mensajes de cola (pendiente de ADR-027).
- **Hecho cuando:** dependency-cruiser no da violaciones, ninguna consulta cruza esquemas y todo está en verde.

### F2. Paquetes compartidos y gateway (2–3 días)
- Extraer `service-kit`, `auth-client`, `contracts` y `pos-connectors`.
- Crear `deploy/gateway/nginx.conf` con la tabla de rutas y el servicio `gateway` en docker compose. Al principio todas las rutas apuntan a `apps/api`, que pasa a escuchar en otro puerto.
- **Hecho cuando:** web-qr y panel funcionan a través del gateway y todo está en verde.

### F3. Simuladores (1–2 días)
- `fake-psp` y `fake-pos` como servicios; `FakePaymentProvider` y `FakePosConnector` pasan a ser clientes HTTP.
- **Hecho cuando:** el modo caos (`FAKE_PSP_CHAOS=on`) y la caída simulada de la caja siguen pasando sus tests.

### F4. Servicios periféricos (2–3 días)
- `realtime`, `audit` y `analytics` (modelo de lectura a partir de `PaymentCaptured`).
- **Hecho cuando:** la sala del panel se actualiza en < 3 s (criterio 5) y el registro de actividad muestra las entradas de todos los servicios.

### F5. `identity` y `merchant-venues` (3–4 días)
- `identity` sirve `/internal/sessions/*`.
- `merchant-venues` sirve la resolución de QR y el contexto de mesa.
- Alta de comercio con doble factor de extremo a extremo (`merchant-onboarding`, `alta-comercio.spec.ts`).
- **Hecho cuando:** la condición de «hecho» de M0 sigue cumpliéndose en local.

### F6. `loyalty` y `table-payments` (3–4 días)
- `loyalty` sale con `claim` y la emisión de cupones por `/internal/*`.
- Lo que queda de `apps/api` es `table-payments`: se renombra y se mueve a `services/`.
- **Hecho cuando:** los tres criterios de concurrencia e idempotencia pasan contra el gateway y `apps/api` ya no existe.

### F7. Kubernetes local con k3d (2–3 días)
- Imágenes, clúster k3d, manifiestos Kustomize y overlay local ([§3.5](#35-despliegue-mínimo-lo-único-de-devops-que-entra)).
- `pnpm k8s:up`, `pnpm k8s:seed` y `pnpm k8s:down`.
- **Hecho cuando:** `pnpm e2e` pasa contra el despliegue en k3d, y un comercio de pruebas se registra con doble factor y crea un local con mesas en k3d (la condición de «hecho» de M0, con k3d en lugar de staging en AWS).

**Total orientativo:** 18–25 días de trabajo `[HIPÓTESIS]`.

## 5. Estrategia de pruebas

- Los tests unitarios se mueven con su código.
- Los E2E de `apps/api/test/*.e2e-spec.ts` se dividen:
  - **de servicio:** cada servicio contra su esquema, con los demás simulados en `/internal/*`;
  - **de sistema** (`e2e/system/`): los escenarios de dinero (`payments`, `split-realtime`, `loyalty-coupons`, `queue-sqs`, `security`) contra el gateway con todos los servicios arrancados.
- Pruebas de contrato de eventos y de rutas internas con los esquemas zod de `packages/contracts`.
- `merchantLogin` (`test/merchant-session.ts`) pasa a un helper compartido de pruebas de sistema.

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper una invariante de dinero al mover código | El núcleo ACID no se parte (decisión 3). Los criterios 2–4 se ejecutan al final de cada fase |
| La validación de sesión por red añade latencia (NFR-03: p95 < 300 ms) | Una llamada interna por petición dentro del clúster; si hace falta, cache corta en Redis invalidada en logout o cambio de rol `[HIPÓTESIS]` |
| La auditoría pasa a ser eventual | Se escribe en el outbox dentro de la transacción: no se pierde ninguna entrada, solo llega con retraso |
| Pérdida o duplicado de eventos en el reparto por consumidor | Outbox + procesadores idempotentes (ya lo exige ADR-026) y DLQ por cola |
| Más procesos en local (10 servicios + 2 apps) | Turborepo con `--filter`; perfiles de arranque en `pnpm dev` |
| Trazas cortadas entre petición y trabajo | Propagación de contexto en F1 |

## 7. Impacto en la documentación

- `DECISIONS.md`: ADR-029 y ADR-030 nuevas; ADR-009 sustituida; ADR-011 sustituida en su parte de despliegue; referencias en ADR-021/022/025/026/027/028 donde citan módulos, `apps/api` o ECS (por ejemplo, el SIGTERM «en ECS» y que «las colas las crea Terraform» de ADR-026).
- `ARCHITECTURE.md`: §2, §3 (fila Cloud), §4, §5, §10 (esquemas por servicio), §12, §13, §14 (entornos y despliegue) y §16.
- `ROADMAP.md`: nuevo hito de migración y revisión de M0 (Terraform, ECS y staging en AWS).
- `CLAUDE.md`, `README.md`, `DEMO.md` (comandos y puertos) y `STRIDE.md` (gateway y `/internal/*`).

<a id="decisiones-pendientes"></a>
## 8. Decisiones tomadas en la revisión (12-nov-2026)

1. **Kubernetes local:** k3d.
2. **Gateway:** nginx.
3. **ADR-011:** el MVP se despliega en Kubernetes local (k3d) en lugar de ECS Fargate. ADR-011 se sustituye entera (ADR-030); la nube, la región y el CDN/WAF quedan en D-07.

<a id="recomendaciones-devops"></a>
## 9. Recomendaciones para los experimentos DevOps (fuera de este plan)

- **CI/CD:** construir solo los servicios afectados (`turbo --filter=...[origin/master]`); publicar imágenes en un registro; escaneo de imágenes (Trivy) y SBOM.
- **Empaquetado y entrega:** Helm o Kustomize por entorno; GitOps con Argo CD o Flux; despliegues *canary* o *blue/green* con Argo Rollouts.
- **Desarrollo en el clúster:** Tilt o Skaffold.
- **Seguridad:** mTLS entre servicios con una malla (Linkerd o Istio) en lugar del secreto compartido; `NetworkPolicy` para que solo el gateway llegue a las rutas públicas; External Secrets o Sealed Secrets.
- **Observabilidad:** OpenTelemetry Collector, Prometheus + Grafana, Loki y Jaeger/Tempo dentro del clúster.
- **Resiliencia y escala:** HPA (por ejemplo, del worker de `table-payments` según la profundidad de la cola), PodDisruptionBudgets, *readiness/liveness probes* sobre `/health`.
- **Pruebas:** carga con k6 frente a los objetivos de M5 (50 pagos/s y 2.000 conexiones SSE); caos con Chaos Mesh junto al modo caos del PSP simulado.
- **Entrada al clúster:** ingress-nginx (o Gateway API) delante de `web-qr` y `merchant-panel` en lugar del balanceador de k3d, con TLS de cert-manager.
- **Infraestructura en la nube (si se sale de local):** Terraform con un Kubernetes gestionado (EKS u otro), base de datos y Redis gestionados, y SQS con DLQ creadas por Terraform (ADR-026). Los mismos manifiestos con otro overlay de Kustomize.

# ARCHITECTURE: arquitectura técnica de ComerceChat (MVP)

> **Estado:** borrador v0.2 (17-oct-2026). Añade la arquitectura de la PoC local ([§16](#poc-local)).
> **Documentos relacionados:**
> - Requisitos en [SPEC.md](SPEC.md).
> - Razones de cada elección en [DECISIONS.md](DECISIONS.md).
> - Plan de construcción en [ROADMAP.md](ROADMAP.md).

---

## 1. Principios

1. **El dinero no pasa por nosotros.** El PSP es la fuente de verdad del dinero; nuestra base de datos es la fuente de verdad de pedidos, puntos y cupones. (REG-01, ADR-003)
2. **La web QR es el producto.** Debe cargar rápido, funcionar sin instalación y tolerar fallos del software de caja. (ADR-002)
3. **Monolito modular en TypeScript de punta a punta.** Fronteras claras entre módulos para poder extraer servicios más adelante, sin coste operativo hoy. (ADR-008, ADR-009)
4. **Proveedores externos detrás de interfaces.** `PaymentProvider` (PSP) y `PosConnector` (software de caja), para cambiar de proveedor sin reescribir. (D-01, D-02)
5. **Todo lo financiero es idempotente, auditable y de solo-inserción** (pagos, puntos, canjes).
6. **Seguridad y privacidad desde el diseño**: ámbito PCI mínimo, consentimientos granulares, datos en la UE.

## 2. Vista general

```
                     ┌──────────── Cloudflare (DNS, WAF, CDN, anti-bots, límites de peticiones) ────────────┐
                     │                                                                               │
 Comensal (navegador)│─► web-qr        (Next.js, pay.<dominio>)                                       │
 App usuario (Expo) ─│─► api           (NestJS, api.<dominio>)                                        │
 Panel comercio     ─│─► merchant-panel (Next.js, panel.<dominio>)                                    │
 Backoffice interno ─│─► admin (en merchant-panel, rutas /admin con SSO y lista de IP permitidas)     │
                     └───────────────────────────────────┬───────────────────────────────────────────┘
                                                         ▼
          ┌──────────────────── apps/api: NestJS, monolito modular (ECS Fargate) ────────────────────┐
          │ auth · users · merchants · venues · qr · catalog · orders · payments · loyalty ·         │
          │ coupons · campaigns · crm · notifications · analytics · pos-integrations · risk ·        │
          │ audit · admin · realtime (WS/SSE)                                                        │
          └───────┬───────────────┬────────────────────┬──────────────────────┬──────────────────────┘
                  ▼               ▼                    ▼                      ▼
          PostgreSQL 16      Redis (ElastiCache)   SQS (+ colas de error)   S3 (imágenes, PDFs QR,
          + PostGIS (RDS     cache, bloqueos,      ▲                        exportaciones CSV)
          Multi-AZ)          límites, estado mesa, │
                  │          pub/sub tiempo real   │
                  │                                │
                  │              apps/api en modo worker (mismo código, distinto proceso):
                  │              webhooks PSP · liberación de puntos · campañas · sincronización
                  │              con cajas · notificaciones · conciliación diaria
                  ▼
          Réplica de lectura → Metabase (MVP) → BigQuery/ClickHouse (fase 2)

 Externos: PSP de plataforma [D-01] · APIs de software de caja [D-02] · FCM/APNs (Expo Push)
           · Postmark/SES · SMS/WhatsApp OTP [D-04] · WhatsApp Business · Mapbox/MapLibre
           · PostHog (nube UE) · Sentry · Grafana Cloud/Datadog
```

## 3. Stack tecnológico

| Capa | Tecnología | Motivo (detalle en DECISIONS) |
|---|---|---|
| Web QR | Next.js (App Router) + TypeScript + React, renderizado en servidor y en el borde | Carga < 1,5 s en 4G sin instalación (ADR-002) |
| Panel comercio + backoffice | Next.js + shadcn/ui + TanStack Query | Mismo stack que la web QR |
| App usuario | React Native con Expo (EAS Build + EAS Update) | Comparte TypeScript y tipos (ADR-008) |
| Backend | NestJS 12 (ESM, Node 22 LTS), monolito modular; tests con Vitest | ADR-009, ADR-020 |
| ORM / migraciones | Drizzle ORM + migraciones SQL generadas con drizzle-kit y revisadas | SQL explícito para bloqueos, RETURNING y PostGIS (ADR-019) |
| Base de datos | PostgreSQL 16 + PostGIS (RDS Multi-AZ) | ACID para el registro de puntos y los canjes; consultas geográficas (ADR-010) |
| Cache / bloqueos / tiempo real | Redis (ElastiCache) | ADR-010 |
| Colas | SQS + colas de error (DLQ); BullMQ en local | Webhooks y campañas asíncronos con reintentos |
| Tiempo real | Server-Sent Events (web QR) y WebSocket (panel), con pub/sub de Redis | Estado compartido de la mesa |
| Cloud | AWS eu-south-2 (España); Terraform; ECS Fargate | ADR-011 |
| CDN / WAF | Cloudflare | Anti-bots, límites de peticiones, protección DDoS |
| Autenticación | OTP por teléfono + passkeys + Apple/Google (usuarios); email + contraseña + doble factor obligatorio (comercios) | ADR-013; proveedor [D-03] |
| Pagos | PSP de plataforma con componentes de pago alojados | ADR-003, PCI SAQ A |
| Notificaciones | Expo Push, Postmark/SES, proveedor oficial de WhatsApp Business | [D-04] |
| Mapas | MapLibre + teselas de Mapbox o MapTiler | Más barato que Google Maps a escala |
| Analítica de producto | PostHog (nube UE); grabación de sesiones desactivada en pantallas de pago | — |
| Errores / observabilidad | Sentry + OpenTelemetry → Grafana Cloud o Datadog; alertas a PagerDuty u Opsgenie | NFR-13 |
| CI/CD | GitHub Actions; Semgrep; escaneo de secretos (gitleaks); Dependabot | — |

## 4. Estructura del repositorio (monorepo)

```
comercechat/
├─ apps/
│  ├─ api/                 # NestJS (modo HTTP + modo worker vía variable de entorno)
│  ├─ web-qr/              # Next.js · pay.<dominio>
│  ├─ merchant-panel/      # Next.js · panel.<dominio> (+ /admin)
│  └─ mobile/              # Expo React Native
├─ packages/
│  ├─ shared-types/        # DTOs, enums, esquemas zod compartidos
│  ├─ api-client/          # cliente generado desde OpenAPI (pendiente, ADR-020)
│  ├─ ui/                  # componentes compartidos web (pendiente)
│  └─ config/              # eslint, tsconfig, prettier (de momento en la raíz)
├─ infra/
│  └─ terraform/           # VPC, RDS, ElastiCache, ECS, SQS, S3, KMS, IAM, Secrets
├─ docs/                   # (opcional) diagramas, runbooks
└─ SPEC.md · ARCHITECTURE.md · DECISIONS.md · ROADMAP.md · CONTEXT.md
```

**Herramientas del monorepo:** pnpm workspaces + Turborepo.

## 5. Módulos del backend

| Módulo | Responsabilidad | Requisitos de SPEC |
|---|---|---|
| `auth` | OTP, passkeys, OAuth Apple/Google, sesiones y JWT, doble factor de comercios, control de acceso por roles | FR-USR-03, FR-MER-01 |
| `users` | Perfil, consentimientos versionados, borrado y exportación GDPR, dispositivos | FR-USR-* |
| `merchants` | Comercio, usuarios del comercio y roles, estado KYB sincronizado con el PSP, plan | FR-MER-* |
| `venues` | Locales, mesas, horarios, geolocalización | FR-MER-03/04 |
| `qr` | Emisión, firma, resolución, revocación y PDFs | FR-QR-* |
| `catalog` | Carta (sincronizada desde el software de caja o manual) | FR-ORD-02 |
| `orders` | Pedidos, cuenta de la mesa, cálculo de pendiente, reparto de la cuenta | FR-ORD-*, FR-PAY-02 |
| `payments` | Sesiones de pago, `PaymentProvider`, webhooks, reembolsos, disputas, conciliación | FR-PAY-* |
| `loyalty` | Programas, registro de puntos, liberación de PENDING, recompensas | FR-LOY-* |
| `coupons` | Promociones, emisión, reserva y canje atómicos | FR-CPN-* |
| `campaigns` | Segmentación, envío, coste, atribución | FR-CPN-07, FR-NOT-04 |
| `crm` | Vista de clientes con consentimiento, segmentos | FR-CRM-* |
| `notifications` | Push, email, SMS y WhatsApp; plantillas; preferencias | FR-NOT-* |
| `analytics` | Métricas del comercio (vistas materializadas) y envío de eventos a PostHog | FR-ANA-* |
| `pos-integrations` | `PosConnector` + adaptadores por software de caja, emparejamiento de mesas, modo degradado | FR-POS-* |
| `realtime` | Canal por mesa (SSE/WS) sobre pub/sub de Redis | FR-ORD-01, FR-MER-08 |
| `risk` | Reglas, puntuación de riesgo, límites, cola de revisión | §9 |
| `audit` | `AuditLog` de solo-inserción | NFR, FR-ADM-05 |
| `admin` | Backoffice | FR-ADM-* |

**Reglas entre módulos:**
- Un módulo solo accede a las tablas de otro a través de su servicio público. Prohibido hacer joins entre tablas de módulos distintos desde fuera del módulo propietario; la excepción son las vistas de `analytics` sobre la réplica.
- Los eventos de dominio (`PaymentCaptured`, `PaymentRefunded`, `PaymentDisputed`, `CouponRedeemed`…) se publican en un bus interno con patrón **outbox** (tabla `outbox_events` + worker → SQS). Así no se pierden eventos si el proceso cae entre el commit y la publicación.

## 6. Abstracciones de proveedores

### 6.1 `PaymentProvider`

```ts
interface PaymentProvider {
  // Alta del comercio ante el PSP
  createConnectedAccount(merchant: MerchantInput): Promise<{ pspAccountId: string }>;
  createOnboardingLink(pspAccountId: string, returnUrl: string): Promise<{ url: string }>;

  // Pagos
  createPaymentSession(input: {
    pspAccountId: string;
    amountCents: number; tipCents: number; currency: 'EUR';
    platformFeeCents: number;
    statementDescriptor: string;
    methods: PaymentMethod[];           // CARD | APPLE_PAY | GOOGLE_PAY | BIZUM | ALIPAY_PLUS
    idempotencyKey: string;
    metadata: { paymentId: string; orderId?: string; locationId: string };
  }): Promise<{ pspPaymentId: string; clientSecret: string }>;

  refund(pspPaymentId: string, amountCents: number, idempotencyKey: string): Promise<RefundResult>;
  submitDisputeEvidence(pspDisputeId: string, evidence: DisputeEvidence): Promise<void>;

  // Webhooks
  verifyAndParseWebhook(rawBody: Buffer, headers: Record<string, string>): PspEvent; // lanza error si la firma no es válida

  // Conciliación
  listBalanceTransactions(pspAccountId: string, from: Date, to: Date): AsyncIterable<PspBalanceTx>;
}
```

Hay una implementación por PSP evaluado (`StripeConnectProvider`, `AdyenPlatformsProvider`, `MoneiProvider`). En el MVP solo se activa una ([D-01](DECISIONS.md#d-01)).

Para la PoC y los tests existe además `FakePaymentProvider`, que simula el PSP de forma local ([§16.3](#poc-fakes)).

### 6.2 `PosConnector`

```ts
interface PosConnector {
  // Implementado en P2 (apps/api/src/pos/pos-connector.ts). `locationId` selecciona credenciales y local.
  getOpenBill(locationId: string, externalTableId: string): Promise<PosBill | null>;
  registerPayment(locationId: string, externalTableId: string,
    p: { amountCents: number; tipCents: number; reference: string }): Promise<{ billClosed: boolean }>;
  health(locationId: string): Promise<'ok' | 'degraded' | 'down'>;
  // Pendiente (M2, con D-02):
  getMenu(locationId: string): Promise<MenuSnapshot>;
  sendOrder(locationId: string, externalTableId: string, items: OrderItemInput[]): Promise<{ externalOrderId: string }>;
  listTables(locationId: string): Promise<ExternalTable[]>;
}
```

Hay un adaptador por software de caja ([D-02](DECISIONS.md#d-02)). Para la PoC existe además `FakePosConnector`, respaldado por el "simulador de caja" ([§16.3](#poc-fakes)). También existe un `ManualPosConnector`: el STAFF introduce el importe, como modo degradado (FR-ORD-05). El adaptador activo se fija por local en `MerchantLocation.pos_integration_id`.

## 7. Flujo de pago

```
web-qr                     api                          PSP                      software de caja
  │ GET /v1/qr/{code}       │                             │                            │
  │────────────────────────►│ valida firma/estado QR      │                            │
  │                         │ getOpenBill ───────────────────────────────────────────►│
  │◄──── comercio + cuenta ─│                             │                            │
  │ POST /v1/payment-sessions (Idempotency-Key)           │                            │
  │  {orderId, split, tip, couponId?}                     │                            │
  │────────────────────────►│ tx: crea Payment(CREATED),  │                            │
  │                         │     reserva cupón, bloquea  │                            │
  │                         │     la parte de la cuenta   │                            │
  │                         │ createPaymentSession ──────►│                            │
  │◄──── clientSecret ──────│                             │                            │
  │ componente del PSP (tarjeta/Apple Pay/Google Pay/Bizum, 3DS)                       │
  │──────────────────────────────────────────────────────►│                            │
  │                         │◄──── webhook payment.succeeded (firmado)                 │
  │                         │ verifica firma → registra evento (único) → 200           │
  │                         │ worker: Payment=CAPTURED, Transaction(CHARGE),           │
  │                         │   cupón=REDEEMED, puntos EARN(PENDING), outbox           │
  │                         │ registerPayment ────────────────────────────────────────►│
  │◄── SSE: mesa actualizada│                             │                            │
  │ pantalla de éxito (consulta el estado del Payment; nunca confía solo en la redirección)
```

**Reglas:**
- `POST /payment-sessions` exige la cabecera `Idempotency-Key`. La misma clave devuelve la misma sesión.
- **Webhooks:** se verifica la firma con el cuerpo en bruto, se guarda en `psp_webhook_events(psp_event_id UNIQUE)` y se responde 200 inmediatamente. El procesamiento ocurre en el worker y es idempotente (si el evento ya está procesado, no se repite).
- **Sesión de pago con caducidad de 15 min:** un trabajo programado libera la parte de la cuenta y el cupón `RESERVED` si no llega confirmación.
- **Fallo al registrar el pago en el software de caja:** reintentos con espera exponencial durante 30 min. Si sigue fallando, alerta al STAFF ("Mesa 7: pago de 42 € recibido, regístralo a mano") y aviso en el panel. **El pago no se revierte.**
- **Conciliación diaria** (trabajo a las 06:00): `listBalanceTransactions` frente a `Transaction`. Las discrepancias generan una alerta y un ticket interno.

**Reparto de la cuenta y concurrencia:**
- La cuenta se lee del TPV y se refleja en `orders`/`order_items` (con `pos_line_id`). Cada pago reserva su parte en `order_allocations` (importe o unidades de una línea) con el pedido bloqueado (`SELECT … FOR UPDATE`), así que dos comensales no pueden reservar lo mismo (implementado en P3, [ADR-022](DECISIONS.md#adr-022)).
- Las reservas no pagadas caducan con la sesión y se liberan si el pago falla, se cancela o se sustituye.

## 8. Diseño de QR

| Tipo | Contenido | Validación |
|---|---|---|
| `STATIC_TABLE` / `STATIC_COUNTER` | `https://pay.<dominio>/t/{shortCode}` (10–12 caracteres base62 aleatorios) | El `shortCode` se busca en BD (índice único); el registro guarda `signature = HMAC-SHA256(secret_kms, id‖location‖table‖version)`, que se recalcula para detectar manipulación de la BD; estado ACTIVE |
| `DYNAMIC_AMOUNT` | `https://pay.<dominio>/d/{token}`; `token` = JWS (Ed25519) con `{qrId, locationId, tableId, amountCents, exp, nonce}`. Lo genera la caja para una mesa por lo pendiente ([ADR-023](DECISIONS.md#adr-023)) | Firma válida, `exp` no vencido, `nonce` igual al de la BD, QR `ACTIVE` y sin otra sesión viva (fila bloqueada); `CONSUMED` al capturar ([ADR-022](DECISIONS.md#adr-022)) |

- La clave de firma se rota (`kid` en la cabecera del JWS) y las claves privadas se custodian en KMS.
- Revocación: `status = REVOKED` + invalidación de la cache en Redis. Efectiva en < 60 s (FR-QR-05).
- Medidas físicas (placas antimanipulación) en [CONTEXT.md](CONTEXT.md).

## 9. Seguridad y fraude: controles técnicos

| Amenaza | Controles implementados |
|---|---|
| QR falsificado | Dominio único; cabecera de identidad del comercio; códigos no adivinables; firma; HSTS + dominio en listas de *preload*; vigilancia de dominios parecidos |
| Pruebas de tarjetas robadas y pagos fraudulentos | Antifraude del PSP (Radar o equivalente); 3DS según riesgo; límites de peticiones por IP, dispositivo y QR en Cloudflare + Redis; Turnstile (CAPTCHA invisible); importe máximo para invitados (FR-PAY-09) |
| Cuentas falsas | OTP; bloqueo de números VoIP o desechables (consulta del tipo de línea); huella de dispositivo; recompensas solo tras un pago real; límite de cuentas por dispositivo |
| Chargebacks | Descripción clara en el extracto; envío automático de pruebas; reversión de puntos; responsabilidad contractual del comercio |
| Robo de cuentas | Passkeys; señales de riesgo en el OTP; alerta al cambiar de dispositivo; bloqueo de canjes 24–48 h tras cambiar de teléfono |
| Manipulación de puntos | Los puntos solo se crean desde el worker de webhooks; nunca hay endpoint de "añadir puntos" desde el cliente; estado PENDING; ajustes solo por OWNER con auditoría; detección de anomalías (mismo usuario + mismo STAFF + mismo local de forma repetida) |
| Cupones duplicados | `UNIQUE(coupon_redemptions.coupon_id)`; reserva con `UPDATE coupons SET status='RESERVED' WHERE id=$1 AND status='ACTIVE' RETURNING *` (atómico); vinculación al `user_id` |
| Blanqueo de capitales | Sin saldo ni envíos entre usuarios (REG-02); reglas del módulo `risk` (propina > 30 %, importes redondos repetidos, volumen incoherente con la categoría) → `RiskEvent(REVIEW)`; canal para enviar señales al PSP |
| Abuso de API y scraping | WAF; límites de peticiones; identificadores públicos opacos (UUIDv7 internos + códigos públicos aleatorios) |
| Amenaza interna | Acceso a producción temporal y aprobado (SSO + rol IAM con caducidad); registro de auditoría; separación de funciones |
| Secretos | AWS Secrets Manager; rotación; gitleaks en CI |
| Datos personales | Teléfono y email cifrados a nivel de columna (pgcrypto o cifrado en la aplicación con KMS) + hash para búsquedas; logs sin datos personales (redacción automática) |

## 10. Modelo de datos

Convenciones:
- Identificadores `uuid` (v7).
- Importes en `*_cents BIGINT` + `currency CHAR(3)`.
- Columnas `created_at` y `updated_at` en todas las tablas.
- Borrado lógico solo donde se indica.
- `status` como enum de Postgres.

```
users(id, phone_e164_enc, phone_hash UNIQUE, email_enc?, name?, birthdate?, locale, status, risk_score, created_at)
user_consents(id, user_id→users, type[TERMS|MKT_PLATFORM|SHARE_WITH_MERCHANT], merchant_id?→merchants,
              granted BOOL, version, source, created_at)            -- solo inserción; el último registro manda
devices(id, user_id→users, push_token, platform, fingerprint_hash, last_seen_at)

merchants(id, legal_name, tax_id, brand_name, status[ONBOARDING|ACTIVE|SUSPENDED|REJECTED],
          psp, psp_account_id UNIQUE, psp_kyb_status, plan_id, created_at)
merchant_users(id, merchant_id→merchants, email UNIQUE, role[OWNER|MANAGER|STAFF], mfa_enabled, status)
merchant_locations(id, merchant_id→merchants, name, address, geo GEOGRAPHY(Point), timezone,
                   opening_hours JSONB, category, pos_integration_id?→pos_integrations, tip_config JSONB)
tables(id, location_id→merchant_locations, label, capacity, external_table_id?, active)
pos_integrations(id, merchant_id, provider, credentials_secret_ref, status, last_health_at)

qr_codes(id, type[STATIC_TABLE|STATIC_COUNTER|DYNAMIC_AMOUNT], location_id, table_id?, short_code UNIQUE,
         signature, amount_cents?, currency, nonce?, expires_at?, status[ACTIVE|REVOKED|CONSUMED|EXPIRED],
         version, created_by, created_at)

products(id, location_id, category_id, name, description, price_cents, tax_rate, allergens TEXT[],
         modifiers JSONB, available, pos_external_id)
orders(id, location_id, table_id?, user_id?, source[QR|POS|COUNTER],
       status[OPEN|SENT|IN_PREPARATION|SERVED|PAID|CANCELLED],
       subtotal_cents, discount_cents, total_cents, pos_external_id, created_at)
order_items(id, order_id→orders, product_id?, name_snapshot, qty, unit_price_cents, modifiers JSONB)
order_allocations(id, order_id, payment_id?, order_item_id?, amount_cents, status[RESERVED|PAID|RELEASED], expires_at)

payments(id, order_id?, location_id, merchant_id, user_id?, psp, psp_payment_id UNIQUE,
         method[CARD|APPLE_PAY|GOOGLE_PAY|BIZUM|ALIPAY_PLUS|WECHAT_PAY],
         amount_cents, tip_cents, discount_cents, platform_fee_cents, psp_fee_cents?, currency,
         status[CREATED|AUTHORIZED|CAPTURED|FAILED|PARTIALLY_REFUNDED|REFUNDED|DISPUTED|CHARGED_BACK],
         idempotency_key UNIQUE, guest_session_id?, expires_at, created_at)
transactions(id, payment_id→payments, type[CHARGE|REFUND|CHARGEBACK|CHARGEBACK_REVERSAL|PAYOUT|FEE],
             amount_cents, psp_reference UNIQUE, occurred_at)          -- solo inserción; espejo del PSP
psp_webhook_events(id, psp, psp_event_id UNIQUE, type, payload JSONB, received_at, processed_at?, error?)

loyalty_programs(id, merchant_id, type[POINTS|STAMPS], earn_rule JSONB, hold_hours, expiry_days, status)
loyalty_rewards(id, program_id, name, cost_points, active)
loyalty_accounts(id, user_id, program_id, balance_cached, UNIQUE(user_id, program_id))
points_ledger_entries(id, account_id, type[EARN|REDEEM|EXPIRE|REVERSE|ADJUST], points, status[PENDING|AVAILABLE|VOID],
                      payment_id?, coupon_redemption_id?, reason?, created_by?, available_at?, created_at)
                      -- solo inserción salvo la transición de estado PENDING→AVAILABLE|VOID

promotions(id, merchant_id, template, name, audience JSONB, rules JSONB, channels TEXT[], budget_cents?,
           max_redemptions?, starts_at, ends_at, status[DRAFT|SCHEDULED|ACTIVE|ENDED|CANCELLED])
coupons(id, promotion_id?, reward_id?, merchant_id, user_id?, code UNIQUE,
        status[ACTIVE|RESERVED|REDEEMED|EXPIRED|REVOKED], reserved_payment_id?, reserved_until?, valid_from, valid_to)
coupon_redemptions(id, coupon_id UNIQUE→coupons, payment_id→payments, discount_cents, redeemed_at)
campaigns(id, merchant_id, promotion_id?, channel, audience_count, cost_cents, status, scheduled_at, sent_at)

reviews(id, location_id, user_id?, payment_id UNIQUE, rating SMALLINT CHECK 1..5, comment?, visibility, created_at)
notifications(id, recipient_type[USER|MERCHANT_USER], recipient_id, channel[PUSH|EMAIL|WHATSAPP|SMS|IN_APP],
              template, payload JSONB, campaign_id?, status, sent_at?, opened_at?)
reservations(...)                                                        -- fase 2, no crear en el MVP

audit_logs(id, actor_type, actor_id, action, entity, entity_id, before JSONB, after JSONB, ip, created_at)  -- solo inserción
risk_events(id, entity_type, entity_id, rule, score, action[ALLOW|REVIEW|BLOCK], resolved_by?, created_at)
outbox_events(id, aggregate, aggregate_id, type, payload JSONB, created_at, published_at?)
```

**Relaciones clave:**
- `merchants 1─N merchant_locations 1─N tables 1─N qr_codes`
- `orders 1─N payments 1─N transactions`; `orders 1─N order_allocations`
- `users 1─N loyalty_accounts N─1 loyalty_programs N─1 merchants`; `loyalty_accounts 1─N points_ledger_entries`
- `promotions 1─N coupons 1─0..1 coupon_redemptions 1─1 payments`
- El CRM del comercio es `users` filtrado por el último `user_consents(SHARE_WITH_MERCHANT, merchant_id)` con valor `granted`.
- `payments 1─0..1 reviews`

**Saldo de puntos:** `SUM(points) WHERE status='AVAILABLE'`. `balance_cached` se actualiza en la misma transacción que la entrada del registro y se verifica cada noche. Si hay discrepancia, alerta.

## 11. API

- REST JSON en `api.<dominio>/v1`. La especificación OpenAPI se genera desde NestJS y de ella sale `packages/api-client`.
- **Errores:** formato RFC 9457 (`application/problem+json`) con un `code` estable (p. ej. `COUPON_ALREADY_REDEEMED`).
- **Idempotencia:** cabecera `Idempotency-Key` obligatoria en todas las peticiones POST que crean pagos, reembolsos, canjes o campañas. Se guarda 24 h con la respuesta.
- **Autenticación:**
  - Usuarios: JWT de acceso de 15 min + token de renovación rotativo.
  - Invitados: `guest_session` firmada, ligada al QR y con caducidad.
  - Comercios: sesión con cookie httpOnly + doble factor.
- **Paginación** por cursor.
- **Webhooks entrantes:** `POST /v1/webhooks/psp/{provider}` y `POST /v1/webhooks/pos/{provider}`, con la firma verificada sobre el cuerpo en bruto.
- **Endpoints principales del MVP (ilustrativo):**
  - `GET /qr/{code}` · `POST /payment-sessions` · `GET /payments/{id}` · `POST /auth/otp/start|verify` · `POST /guest/claim-points`
  - `GET /me/loyalty` · `GET /me/coupons` · `GET /merchants/nearby?lat&lng`
  - Panel: `/merchant/locations` · `/tables` · `/qr` · `/promotions` · `/customers` · `/analytics/*` · `/payments` · `/refunds`

## 12. Tiempo real

- Canal de Redis por local: `rt:location:{locationId}`. Eventos `table.updated` y `counter.updated` con un motivo (`payment.started`, `payment.captured`, `bill.closed`, `pos.item_added`…). Solo avisan: el cliente vuelve a pedir los datos.
- **SSE** en la web QR y en el panel, a través de sus propias rutas de Next (la API no se expone al navegador). El flujo empieza con `ready`; si no llega, el cliente pasa a sondeo cada 3 s (necesario tras el túnel rápido de Cloudflare, que no admite SSE). Se descarta WebSocket para el panel ([ADR-022](DECISIONS.md#adr-022)).
- Varias réplicas de la API se coordinan mediante pub/sub de Redis.

## 13. Trabajos asíncronos

| Trabajo | Disparador | Notas |
|---|---|---|
| Procesar webhook del PSP | SQS | Idempotente por `psp_event_id` |
| Registrar pago en el software de caja | Evento `PaymentCaptured` | Reintentos durante 30 min y luego alerta |
| Liberar puntos PENDING → AVAILABLE | Programado cada 15 min | Respeta `hold_hours` |
| Caducar puntos y cupones | Programado diario | Notificación previa a la caducidad |
| Expirar sesiones de pago y reservas | Programado cada minuto | Libera las partes de la cuenta y los cupones |
| Generar y enviar campaña | Panel → SQS | Por lotes; respeta consentimientos |
| Sincronizar la carta desde el software de caja | Programado + webhook del software de caja | — |
| Conciliación con el PSP | Programado diario 06:00 | Alertas por discrepancia |
| Verificar `balance_cached` | Programado diario | — |
| Publicar eventos del outbox | Continuo | — |

## 14. Entornos, despliegue y operación

- **Entornos:**
  - `local`: docker-compose con Postgres+PostGIS, Redis, LocalStack (SQS/S3) y el modo de pruebas del PSP.
  - `staging`: PSP en modo pruebas y un software de caja de pruebas.
  - `prod`.
- **Infraestructura como código:** Terraform con estado remoto en S3 y bloqueo en DynamoDB, y un workspace por entorno.
- **Despliegue:** GitHub Actions → imagen al registro ECR → ECS Fargate con despliegue *rolling* (*blue/green* en fase 2). Las migraciones de BD se ejecutan como tarea previa al despliegue y deben ser compatibles hacia atrás (patrón *expand/contract*).
- La **web QR y el panel** se despliegan en el mismo ECS (o en un hosting compatible en la UE) detrás de Cloudflare.
- **App móvil:** EAS Build → TestFlight / Play interno; EAS Update para cambios de JS.
- **Copias de seguridad:** recuperación a un punto en el tiempo en RDS (35 días) + instantánea diaria en otra región de la UE. Prueba de restauración trimestral.
- **Observabilidad:**
  - Trazas OpenTelemetry con `paymentId` como atributo en todo el recorrido (NFR-13).
  - Paneles de métricas: tasa de éxito de pagos, latencia de webhooks, salud del software de caja por proveedor, errores 5xx.
  - **Alertas:** caída de éxito de pagos > 5 puntos en 15 min; cola de errores de webhooks > 0; software de caja `down` > 5 min; discrepancias de conciliación.
- **Respuesta a incidentes:** guías de actuación (*runbooks*) para "PSP caído", "software de caja caído", "QR falsificado reportado" y "fuga de datos" (notificación a la AEPD en 72 h).

## 15. Seguridad del ciclo de desarrollo

- Revisión de código obligatoria; protección de la rama `main`.
- Análisis estático (Semgrep), auditoría de dependencias y gitleaks en CI.
- Modelado de amenazas (STRIDE) de los flujos de pago y canje antes de M1 y M3.
- **Pentest externo antes del piloto** (NFR-10) y después cada año.
- Revisión de la app móvil según OWASP MASVS L1.
- Política de divulgación responsable de vulnerabilidades + `security.txt`.

---

<a id="poc-local"></a>
## 16. Arquitectura de la PoC local

Alcance funcional en [SPEC.md §3.3](SPEC.md#poc). Decisiones en [DECISIONS.md › ADR-017/018](DECISIONS.md#adr-017).

**Principio:** la PoC usa **el mismo stack y la misma estructura de monorepo** que el MVP. Lo único que cambia son los adaptadores externos, que se sustituyen por versiones simuladas. El código de la PoC es la semilla del MVP, no un prototipo desechable.

### 16.1 Vista general

```
 Portátil del desarrollador (todo local)                     Móviles en la misma wifi
 ┌──────────────────────────────────────────────────────────┐       │ escanean el QR
 │ pnpm dev (Turborepo)                                      │◄──────┘ http://<IP-LAN>:3000/t/{code}
 │  ├─ apps/web-qr          :3000  (+ /fake-psp/checkout)    │         (o https://<túnel> si se usa
 │  ├─ apps/merchant-panel  :3001  (+ /pos-simulator)        │          Stripe en modo de pruebas)
 │  ├─ apps/api (HTTP)      :4000  (/v1, /docs Swagger)      │
 │  └─ apps/api (worker)           (BullMQ)                  │
 │                                                           │
 │ docker compose                                            │
 │  ├─ postgres:16 + postgis  :5432                          │
 │  ├─ redis:7                :6379                          │
 │  └─ mailpit                :8025 (UI) / :1025 (SMTP)      │  ← OTP y justificantes por email
 └──────────────────────────────────────────────────────────┘
```

### 16.2 Qué se sustituye respecto al MVP

| Componente MVP | En la PoC | Selector por variable de entorno |
|---|---|---|
| PSP real (D-01) | `FakePaymentProvider` (opcional: `StripeConnectProvider` en modo de pruebas) | `PAYMENT_PROVIDER=fake\|stripe` |
| Software de caja real (D-02) | `FakePosConnector` + `ManualPosConnector` | `POS_CONNECTOR=fake\|manual` |
| SMS / WhatsApp OTP (D-04) | `ConsoleOtpSender` (log + Mailpit) | `OTP_SENDER=console` |
| Email (Postmark/SES) | SMTP hacia Mailpit | `SMTP_URL=smtp://localhost:1025` |
| SQS | BullMQ sobre Redis | `QUEUE_DRIVER=bullmq` |
| S3 | Sistema de ficheros local (`./.data/uploads`) | `STORAGE_DRIVER=local` |
| KMS (firma de QR) | Claves Ed25519/HMAC en `.env.local` (generadas por `pnpm poc:keys`) | `QR_SIGNING_KEY`, `QR_HMAC_SECRET` |
| Autenticación gestionada (D-03) | JWT propio + OTP por consola, detrás de la misma interfaz `AuthProvider` | `AUTH_PROVIDER=local` |
| Cloudflare / WAF | Límites de peticiones en la aplicación (Redis) | — |
| Sentry / OpenTelemetry / PostHog | Desactivados por defecto; logs estructurados (pino) en la consola | `TELEMETRY=off` |
| Proceso worker separado | Workers BullMQ y relé del outbox dentro del proceso de la API | `PROCESS_ROLE=all\|http\|worker` |
| Colas aisladas por entorno | Prefijo de colas en Redis (los tests usan uno propio) | `QUEUE_PREFIX` |
| Terraform / AWS / ECS | No aplica | — |
| App móvil (Expo) | No aplica | — |

**Regla de código:** las implementaciones simuladas viven en `apps/api/src/pos/fake-pos.*` y `apps/api/src/payments/fake-psp/` y **no se pueden activar en producción**. Si `NODE_ENV=production`, el arranque falla cuando algún selector vale `fake` o `console`.

<a id="poc-fakes"></a>
### 16.3 Simuladores

**`FakePaymentProvider`:**
- `createPaymentSession` crea un registro `fake_psp_sessions` y devuelve `checkoutUrl = /fake-psp/checkout/{sessionId}`.
- La página `/fake-psp/checkout/{id}` (en `web-qr`, visualmente marcada como "PSP SIMULADO") tiene los botones **Pagar**, **Pagar con verificación 3DS → Aprobar/Fallar**, **Simular tarjeta rechazada** y **Abandonar el pago**.
- Al pulsar, el simulador encola la entrega (BullMQ, con reintentos) de un webhook `payment.succeeded` o `payment.failed` firmado al estilo Stripe (`fake-psp-signature: t=…,v1=HMAC(t.body)`, ventana de 5 min) con `FAKE_PSP_WEBHOOK_SECRET`, y lo envía por HTTP a `POST /v1/webhooks/psp/fake`. Así se ejercita **exactamente el mismo camino** que en producción: verificación de firma, deduplicación por `psp_event_id`, worker y outbox.
- **Modo caos** (`FAKE_PSP_CHAOS=on`): retrasa los webhooks de 0 a 10 s, los duplica (×1–3) y los envía desordenados. Sirve para probar la idempotencia.
- La comisión de plataforma se calcula igual que en el MVP y se registra en `transactions` (`CHARGE` + `FEE`), sin dinero real.

**`FakePosConnector` + simulador de caja:**
- Las tablas `fake_pos_menu_items`, `fake_pos_bills`, `fake_pos_bill_items`, `fake_pos_payments` y `fake_pos_locations` hacen de "software de caja". Las mesas se enlazan por `tables.external_table_id`.
- La página `/pos-simulator` del panel permite abrir una cuenta en una mesa, añadir y quitar productos de la carta de prueba, ver los pagos registrados (`registerPayment`) y cerrar la mesa. Cuando un pago cubre la cuenta, el TPV simulado la cierra; el simulador la sigue mostrando 30 min como «Cerrada» con sus pagos.
- `health()` se puede forzar a `down` desde el simulador para probar el modo degradado (FR-POS-06).

**`ConsoleOtpSender`:** escribe `OTP para +34600000001: 123456` en la consola de la API y lo envía a Mailpit. Hay un número mágico (`+34600000000` → `000000`) para las demos.

### 16.4 Datos de prueba (`pnpm db:seed`)

- 2 comercios: "Casa Pepe" (Malasaña) y "La Tasca de Ana" (Chamberí), con coordenadas reales del barrio.
- 8 mesas por local, con sus QR estáticos, enlazadas con la caja simulada (`M1`…`M8`).
- Carta de 20 productos en la caja simulada y cuentas abiertas en las mesas 1, 2 y 3 de cada local (P2). Los alérgenos llegan con la carta propia (FR-ORD-02).
- *(P4)* Programa de puntos (1 punto/€, recompensa "Postre gratis = 50 puntos", `hold_hours = 0`) y una promoción "Vuelve y te invitamos".
- Usuarios del comercio: `owner@casapepe.test` y `staff@casapepe.test` (contraseña `poc1234`).
- 3 usuarios comensales con historial, para que la analítica no aparezca vacía.

### 16.5 Puesta en marcha (objetivo)

```bash
pnpm install
```

```bash
pnpm poc:up
```

`pnpm poc:up` ejecuta en orden:
1. `docker compose up -d`;
2. `pnpm poc:keys` (si no existe `.env.local`);
3. `pnpm db:migrate`;
4. `pnpm db:seed`;
5. `pnpm dev`.

Al terminar imprime las URL y un QR en la terminal para abrir la web QR desde el móvil.

**Acceso desde móviles:** `pnpm poc:tunnel` (o `pnpm poc:up --tunnel`) levanta un túnel rápido de Cloudflare (servicio `tunnel` de docker compose) y escribe su URL en `WEB_QR_BASE_URL`. Solo se expone la web QR: **el navegador del comensal nunca llama a la API**, la web QR la consulta desde su servidor (ADR-021). En desarrollo la API relee `WEB_QR_BASE_URL` sin reiniciar. Con Stripe en modo de pruebas haría falta además `stripe listen --forward-to localhost:4000/v1/webhooks/psp/stripe`.

### 16.6 Pruebas de la PoC

| Prueba | Herramienta | Cubre el criterio de SPEC §3.3 |
|---|---|---|
| Recorrido completo escaneo → pago → puntos → panel | Playwright (2 contextos de navegador: comensal + panel) | 1, 5 |
| 4 pagadores simultáneos en la misma mesa | `apps/api/test/split-realtime.e2e-spec.ts` (✅ P3) + navegador con 4 móviles por el túnel | 2 |
| Webhook duplicado ×10 y desordenado | `apps/api/test/payments.e2e-spec.ts` (✅ P2) y `split-realtime.e2e-spec.ts` con `FAKE_PSP_CHAOS=on` (✅ P3) | 3 |
| 100 canjes paralelos del mismo cupón | Test de integración | 4 |
| Firma de QR manipulada o caducada | Test unitario | — |

### 16.7 Del PoC al MVP

| Paso | Qué hay que hacer |
|---|---|
| D-01 cerrada | Implementar el adaptador real del PSP. `FakePaymentProvider` se queda para tests |
| D-02 cerrada | Implementar el adaptador real del software de caja. `FakePosConnector` se queda para tests y demos |
| Hito M0 del ROADMAP | Añadir Terraform, staging en AWS, CI completa, doble factor de comercio, Sentry y OpenTelemetry |
| Esquema de BD | Las tablas `fake_*` se mantienen solo en entornos que no son producción (migración condicionada o esquema `dev`) |

# DECISIONS: registro de decisiones de arquitectura y producto

> **Formato:** registro de decisiones ligero (ADR). Cada decisión tiene contexto, decisión, alternativas descartadas, consecuencias y estado.
>
> **Estados posibles:** `Aceptada` · `Propuesta` · `Abierta` · `Sustituida por ADR-XXX`.
>
> Las decisiones abiertas (`D-xx`) están al final, con el criterio y el dato que las desbloquea.
>
> **Documentos relacionados:**
> - [SPEC.md](SPEC.md)
> - [ARCHITECTURE.md](ARCHITECTURE.md)
> - [ROADMAP.md](ROADMAP.md)

---

<a id="adr-001"></a>
## ADR-001: alcance del MVP: pago y pedido en mesa para restaurantes (no superapp)

- **Estado:** Aceptada (17-oct-2026)
- **Contexto:** el alcance inicial planteado incluía envíos de dinero entre usuarios, descubrimiento de comercios, reservas, delivery y mini-apps de terceros. Cada uno de esos bloques añade dominios, integraciones y obligaciones regulatorias propias (ADR-004).
- **Decisión:** el MVP cubre un único flujo, *pedir, pagar y volver*, en restaurantes con servicio en mesa: cuenta de la mesa, reparto, propina, pago, puntos y cupones del comercio, y el panel del comercio. El resto queda fuera del alcance técnico del MVP.
- **Alternativas descartadas:** construir la superapp completa por fases desde el principio.
- **Consecuencias:**
  - El alcance excluido está listado en SPEC §3.2.
  - Las funciones nuevas se incorporan por hitos del ROADMAP, con requisitos en SPEC.

<a id="adr-002"></a>
## ADR-002: la web QR sin instalación es el canal principal; la app nativa es secundaria

- **Estado:** Aceptada
- **Contexto:** el usuario no descargará una app para pagar en un restaurante. El momento de mayor intención es el escaneo del QR.
- **Decisión:**
  - Todo el flujo de pago, pedido y reparto de la cuenta funciona en el navegador (Next.js).
  - La cuenta de usuario se pide **después** del pago, con el incentivo de los puntos.
  - La tarjeta en Apple/Google Wallet sustituye a la app para muchos usuarios.
  - La app nativa (Expo) llega en los meses 4–6 con cartera, cupones, historial y lista de comercios.
- **Alternativas descartadas:**
  - App obligatoria (mata la conversión).
  - App Clip / Instant App como canal principal: se pueden evaluar en fase 2, pero añaden dependencia de las tiendas de apps.
- **Consecuencias:**
  - Requisitos de rendimiento estrictos (NFR-01).
  - Sesiones de invitado firmadas.
  - Mecanismo para reclamar los puntos después del pago (FR-USR-02).

<a id="adr-003"></a>
## ADR-003: PSP de plataforma; sin custodia de fondos ni licencia propia

- **Estado:** Aceptada (el PSP concreto queda abierto: [D-01](#d-01))
- **Contexto:**
  - Recibir fondos por cuenta de terceros es un servicio de pago (RDL 19/2018 / PSD2) y requiere autorización del Banco de España o ser agente de una entidad autorizada.
  - La exclusión de "agente comercial" se interpreta de forma restrictiva, y la PSR la acota aún más.
- **Decisión:**
  - Usar un PSP con modelo de plataforma o marketplace.
  - El comercio es cliente del PSP (que le hace la verificación KYB y la prevención del blanqueo).
  - Los fondos van a la cuenta del comercio en el PSP.
  - ComerceChat solo cobra una comisión de plataforma, descontada por el PSP.
  - Solo componentes de pago alojados (PCI SAQ A).
- **Alternativas descartadas:**
  - Adquirencia propia o facilitador de pagos.
  - Licencia de entidad de pago o de dinero electrónico.
  - Cobrar a una cuenta propia y repartir después.
- **Consecuencias:**
  - Dependencia del PSP; se mitiga con la interfaz `PaymentProvider` y un segundo PSP preparado (fase 6–12 m).
  - Operar con licencia propia o como agente de una entidad de pago exigiría rediseñar el flujo de fondos; queda fuera del MVP.

<a id="adr-004"></a>
## ADR-004: sin monedero, envíos entre usuarios ni cashback en dinero

- **Estado:** Aceptada
- **Contexto:**
  - Un saldo prepago es dinero electrónico (requiere licencia de entidad de dinero electrónico, con capital mínimo de 350 k€).
  - Los envíos entre usuarios son un servicio de pago.
  - Además, el saldo y los envíos elevan mucho el riesgo de blanqueo.
- **Decisión:** se eliminan del producto el envío y la solicitud de dinero, el saldo, las recargas y el cashback monetario.
- **Consecuencias:**
  - REG-02 y REG-03 en SPEC.
  - Menor superficie de fraude y blanqueo.
  - Los incentivos se dan en forma de puntos y cupones financiados por el comercio.

<a id="adr-005"></a>
## ADR-005: puntos y cupones del propio comercio; la coalición se pospone

- **Estado:** Aceptada
- **Contexto:**
  - Los puntos gratuitos, que no se compran ni se canjean por dinero y solo valen en el comercio emisor, normalmente no son dinero electrónico [HIPÓTESIS jurídica: pendiente de opinión legal].
  - Una coalición entre varios comercios puede entrar en la exclusión de "red limitada", que obliga a notificar al Banco de España si se superan 1 M€ en 12 meses.
- **Decisión:** en el MVP, cada programa de fidelización pertenece a un único comercio. La coalición entre comercios se aborda en la fase 12–24 m, tras la opinión legal.
- **Consecuencias:**
  - `loyalty_programs.merchant_id` es obligatorio en el MVP.
  - El modelo de datos admite un `coalition_id` futuro sin migraciones destructivas.

<a id="adr-006"></a>
## ADR-006: no emitir tickets ni facturas; delegar en el software de caja

- **Estado:** Aceptada
- **Contexto:** VeriFactu (RD 1007/2023, aplazado por el RDL 15/2025) es obligatorio desde el 1-ene-2027 para sociedades y desde el 1-jul-2027 para el resto. Si emitimos tickets, seríamos un sistema de facturación sujeto a esa normativa.
- **Decisión:**
  - ComerceChat emite solo un "justificante de pago, no válido como factura".
  - La factura simplificada la emite el software de caja del restaurante.
- **Consecuencias:**
  - La integración con el software de caja se vuelve más importante (ADR-007).
  - En el modo sin integración (FR-ORD-05), el restaurante emite el ticket en su software de caja como siempre.

<a id="adr-007"></a>
## ADR-007: la integración con el software de caja es un requisito del MVP

- **Estado:** Aceptada (los proveedores concretos quedan abiertos: [D-02](#d-02))
- **Contexto:** sin integración, el camarero tiene que teclear el importe de cada cuenta, no se puede pagar por platos y el pago no queda registrado en la caja del restaurante.
- **Decisión:**
  - Integrar 1–2 softwares de caja de hostelería antes del piloto, mediante la interfaz `PosConnector`.
  - Mantener `ManualPosConnector` como modo degradado.
- **Consecuencias:**
  - Es la tarea técnica de mayor riesgo del roadmap (hito M2).
  - Requiere acceso a la API (o al programa de socios) de cada fabricante.

<a id="adr-008"></a>
## ADR-008: TypeScript de punta a punta (Next.js, React Native/Expo, NestJS)

- **Estado:** Aceptada (17-oct-2026)
- **Contexto:** el equipo inicial será de 2–4 ingenieros y hay 4 superficies (web QR, panel, app, API).
- **Decisión:** usar TypeScript en todas las capas y compartir tipos y esquemas en `packages/shared-types`.
- **Alternativas descartadas:**
  - Flutter: excelente interfaz, pero obliga a usar Dart además de TypeScript.
  - Backend en Go o Kotlin: sin ventaja suficiente con este tamaño de equipo.
- **Consecuencias:**
  - Contratación más sencilla (perfil fullstack de TypeScript).
  - El rendimiento de Node basta para la carga prevista.

<a id="adr-009"></a>
## ADR-009: monolito modular, no microservicios

- **Estado:** Sustituida por [ADR-029](#adr-029) (12-nov-2026)
- **Decisión:**
  - Una sola aplicación NestJS con módulos de fronteras estrictas (ARCHITECTURE §5).
  - Patrón outbox para los eventos de dominio.
  - El mismo código sirve para el proceso HTTP y para el worker.
- **Alternativas descartadas:** microservicios, por su coste operativo y de coordinación innecesario con menos de 15 ingenieros.
- **Consecuencias:**
  - Se pueden extraer módulos (p. ej. `payments` o `campaigns`) cuando el equipo o la carga lo justifiquen.
  - Las reglas de dependencias entre módulos se verifican en CI (dependency-cruiser o similar).

<a id="adr-010"></a>
## ADR-010: PostgreSQL + PostGIS como base principal; Redis para cache, bloqueos y tiempo real

- **Estado:** Aceptada
- **Contexto:** puntos, cupones y pagos necesitan garantías ACID y restricciones de unicidad. El mapa necesita consultas geográficas.
- **Decisión:**
  - PostgreSQL 16 + PostGIS en RDS Multi-AZ.
  - Redis (ElastiCache) para el estado de la mesa, los bloqueos, los límites de peticiones, los nonces de QR y el pub/sub.
- **Alternativas descartadas:**
  - MongoDB / Firestore: peores garantías transaccionales para un registro contable.
  - DynamoDB: modelado más rígido para un equipo pequeño.

<a id="adr-011"></a>
## ADR-011: AWS en región UE (eu-south-2, España)

- **Estado:** Sustituida por [ADR-030](#adr-030) (12-nov-2026). El proveedor de nube, la región y el CDN/WAF pasan a la decisión abierta [D-07](#d-07)
- **Decisión:**
  - Infraestructura en AWS eu-south-2, con copias de seguridad en otra región de la UE.
  - Terraform y ECS Fargate (sin Kubernetes en el MVP).
  - Cloudflare como CDN y WAF.
- **Alternativas descartadas:**
  - GCP europe-southwest1 (Madrid): igual de válida; se elige AWS por la madurez de RDS, SQS y KMS.
  - Kubernetes: sobrecarga operativa.
- **Consecuencias:** datos alojados en la UE (ayuda con GDPR y con las auditorías de los PSP).

<a id="adr-012"></a>
## ADR-012: registro contable de puntos de solo-inserción

- **Estado:** Aceptada
- **Decisión:**
  - El saldo se deriva de `points_ledger_entries`. Nunca se edita un importe; las correcciones son entradas `REVERSE` o `ADJUST`.
  - Las entradas `EARN` nacen `PENDING` y pasan a `AVAILABLE` tras un periodo de retención (24 h por defecto) para absorber reembolsos y disputas.
  - Los puntos solo se crean desde el procesamiento de webhooks del PSP.
- **Consecuencias:**
  - Trazabilidad completa y resistencia a la manipulación.
  - Hace falta `balance_cached`, con verificación nocturna.

<a id="adr-013"></a>
## ADR-013: autenticación sin contraseña para usuarios; doble factor obligatorio para comercios

- **Estado:** Aceptada (el proveedor concreto queda abierto: [D-03](#d-03))
- **Decisión:**
  - **Usuarios:** OTP por teléfono (SMS o WhatsApp) + passkeys + Sign in with Apple/Google.
  - **Comercios:** email + contraseña + doble factor obligatorio para OWNER y MANAGER, con control de acceso por roles (OWNER, MANAGER, STAFF).
- **Consecuencias:**
  - Coste por SMS o WhatsApp.
  - Bloqueo de números VoIP y desechables.
  - Menor riesgo de robo de cuentas.
- **Implementación del doble factor de comercios:** [ADR-025](#adr-025) (TOTP propio, independiente de D-03).

<a id="adr-014"></a>
## ADR-014: Alipay+/WeChat Pay y carta multiidioma solo en fase 2 y solo vía PSP

- **Estado:** Aceptada
- **Contexto:** aceptar monederos asiáticos (Alipay+, WeChat Pay) y traducir la carta son ampliaciones sin impacto en el dominio si llegan a través del PSP.
- **Decisión:**
  - En la fase 6–12 m: carta traducida (ZH, FR, KO…) y Alipay+/WeChat Pay como métodos de pago **solo si el PSP elegido o un integrador lo ofrece llave en mano**.
  - Sin acuerdo directo con Ant Group ni con Tencent.
- **Consecuencias:** el enum `payments.method` ya incluye `ALIPAY_PLUS` y `WECHAT_PAY`.

<a id="adr-015"></a>
## ADR-015: el estado "pagado" solo se marca por webhook firmado, con idempotencia en todo

- **Estado:** Aceptada
- **Decisión:**
  - Nunca se confía en la redirección del navegador.
  - Todos los POST que crean pagos, reembolsos, canjes o campañas exigen `Idempotency-Key`.
  - Los webhooks se deduplican por `psp_event_id`.
  - Hay conciliación diaria con el PSP.
- **Consecuencias:** complejidad adicional asumida a cambio de no cobrar dos veces ni dar puntos de más.

<a id="adr-016"></a>
## ADR-016: consentimientos granulares y versionados; el CRM solo muestra usuarios con consentimiento

- **Estado:** Aceptada
- **Contexto:** GDPR/LOPDGDD y LSSI art. 21. Compartir datos con comercios y hacer marketing necesita una base legal clara.
- **Decisión:**
  - Tres consentimientos separados: términos, marketing de la plataforma y compartir datos con cada comercio.
  - Se guardan como registros de solo-inserción y con versión.
  - El CRM de cada comercio filtra por el consentimiento vigente.
  - Habrá una evaluación de impacto (DPIA) antes del piloto.

<a id="adr-017"></a>
## ADR-017: construir una PoC local antes del MVP, con el mismo stack (no desechable)

- **Estado:** Aceptada (17-oct-2026)
- **Contexto:**
  - El MVP depende de decisiones externas lentas: contrato con el PSP (D-01), API del software de caja (D-02) y opinión legal.
  - Mientras tanto conviene tener una demo funcional de extremo a extremo y validar pronto las partes técnicas de más riesgo (dividir la cuenta en paralelo, idempotencia, canje atómico, tiempo real).
- **Decisión:**
  - Construir en 3–4 semanas una PoC que funciona entera en local (docker compose + `pnpm dev`), con el alcance de [SPEC §3.3](SPEC.md#poc).
  - Usar el mismo monorepo, stack y módulos que el MVP ([ARCHITECTURE §16](ARCHITECTURE.md#poc-local)), para que el código evolucione hacia el MVP.
- **Alternativas descartadas:**
  - Prototipo desechable (no-code o un único Next.js con todo dentro): más rápido, pero no valida la arquitectura y obliga a reescribir.
  - Esperar a cerrar D-01 y D-02: retrasa 1–2 meses el inicio del desarrollo.
- **Consecuencias:**
  - D-06 (ORM) y una versión local de D-03 (autenticación) se deciden al empezar la PoC.
  - El hito M0 del ROADMAP se reduce, porque parte de la base técnica ya existe.
  - Hay que impedir que los simuladores lleguen a producción (ADR-018).

<a id="adr-018"></a>
## ADR-018: proveedores externos simulados por defecto en la PoC; Stripe en modo de pruebas opcional

- **Estado:** Aceptada (17-oct-2026)
- **Contexto:**
  - La PoC debe funcionar sin cuentas de terceros, sin internet estable y sin HTTPS público.
  - Además, debe ejercitar el camino real de webhooks firmados.
- **Decisión:**
  - `FakePaymentProvider`: página de pago simulada + webhooks firmados + modo caos.
  - `FakePosConnector`: simulador de caja.
  - `ConsoleOtpSender`, Mailpit, BullMQ y almacenamiento local en lugar de SQS y S3.
  - Todos se seleccionan por variables de entorno detrás de las mismas interfaces que el MVP.
  - `StripeConnectProvider` en modo de pruebas como opción para demos con tarjetas de prueba y Apple/Google Pay; requiere túnel HTTPS y Stripe CLI. **Elegir Stripe aquí no prejuzga D-01**: es solo el PSP con el modo de pruebas más accesible.
- **Consecuencias:**
  - El arranque falla en producción si algún selector está en `fake` o `console`.
  - Los simuladores se mantienen como dobles de prueba para los tests de integración y E2E del MVP.

<a id="adr-019"></a>
## ADR-019: Drizzle ORM con migraciones SQL generadas y revisadas (cierra D-06)

- **Estado:** Aceptada (17-oct-2026)
- **Contexto:**
  - Las partes críticas del dominio necesitan SQL explícito: `SELECT … FOR UPDATE` al dividir la cuenta, `UPDATE … WHERE status='ACTIVE' RETURNING` para canjear cupones, índices parciales únicos y PostGIS.
  - Ver [D-06](#d-06).
- **Decisión:**
  - Drizzle ORM (`drizzle-orm` + `node-postgres`). El esquema vive en `apps/api/src/db/schema`.
  - Las migraciones SQL se generan con `drizzle-kit generate` en `apps/api/drizzle/` y **se revisan a mano antes de aplicarlas**.
- **Alternativas descartadas:** Prisma. Es más cómodo para CRUD, pero los bloqueos, el `RETURNING` condicional y PostGIS obligan a usar `$queryRaw` justo en el código más delicado.
- **Consecuencias:**
  - `drizzle-kit` (0.31) entrecomilla los tipos personalizados con paréntesis. La columna `geography(Point, 4326)` hay que corregirla a mano en el SQL generado.
  - La migración inicial añade a mano `CREATE EXTENSION postgis`.
  - Hay que revisar ambas cosas en cada migración que toque PostGIS.

<a id="adr-020"></a>
## ADR-020: versiones y herramientas del stack fijadas en P1

- **Estado:** Aceptada (17-oct-2026)
- **Contexto:** al montar el monorepo, las versiones actuales del ecosistema difieren de las que se suponían al escribir la arquitectura.
  - NestJS 12 y sus paquetes son solo ESM.
  - Next.js 16 elimina el acceso síncrono a `cookies()`/`params` y renombra `middleware` a `proxy`.
  - TypeScript 7 (compilador nativo) no es compatible con el compilador del CLI de Nest.
- **Decisión:**
  - **API:** NestJS 12 en ESM (`"type": "module"`, `module: NodeNext`, imports relativos con extensión `.js`).
  - **Tests:** Vitest con `unplugin-swc` (SWC emite los metadatos de decoradores), en lugar de Jest.
  - **Frontends:** Next.js 16 + React 19.
  - **TypeScript:** fijado a `~5.9` en todo el monorepo.
  - **Gestor de paquetes:** pnpm 12, fijado en `packageManager`. Los scripts de instalación se aprueban de forma explícita en `pnpm-workspace.yaml`: `@swc/core` y `esbuild` permitidos; `@scarf/scarf`, telemetría de Swagger UI, bloqueado.
  - **Variables de entorno:** un único `.env.local` en la raíz.
    - La API lo carga con `dotenv`.
    - Las apps Next lo cargan con `process.loadEnvFile` desde `next.config.ts`. `@next/env` no sirve: Next ya lo ha ejecutado para la carpeta de la app y no recarga otro directorio.
- **Consecuencias:**
  - Subir TypeScript a 7 queda pendiente de que el CLI de Nest lo soporte.
  - `packages/api-client`, `packages/ui` y `packages/config` se crean cuando haga falta. De momento solo existe `packages/shared-types`, con los contratos escritos a mano.

<a id="adr-021"></a>
## ADR-021: flujo de pago de la PoC (P2)

- **Estado:** Aceptada (18-oct-2026)
- **Contexto:** al implementar el pago simulado de P2 hubo que concretar varias cosas que la arquitectura dejaba abiertas.
- **Decisión:**
  - **Lo pendiente de una mesa** = total del TPV − pagado según el TPV − lo capturado por ComerceChat que aún no se ha registrado en el TPV. Así no se cobra dos veces mientras el registro en caja está en curso.
  - **Pedido espejo:** al crear una sesión de pago, la cuenta del TPV se copia en `orders`/`order_items` (`source=POS`, `pos_external_id`). Su fila se bloquea (`FOR UPDATE`) para serializar los pagos de la misma mesa.
  - ~~**Una sola sesión de pago viva por cuenta (solo P2, pago completo):**~~ *Sustituida por [ADR-022](#adr-022) en P3.* una sesión nueva sustituye a las anteriores (`FAILED`/`SUPERSEDED`) y las cancela en el PSP. Si el PSP cobra una sesión ya cancelada, se registra igualmente como `CAPTURED` (el PSP manda) y se anota `payment.captured_after_cancel` en auditoría para reembolsarla. En P3 se sustituye por `order_allocations` (varios pagadores).
  - **La web QR hace de intermediaria (BFF):** el navegador del comensal no llama a la API. Usa renderizado en servidor y *server actions* de Next, y la página de estado se refresca con `router.refresh()`. Solo hay que exponer la web QR (túnel) y la API no queda en internet.
  - **El formulario de pago funciona sin JavaScript** (mejora progresiva): las propinas son radios nativos y la *server action* calcula la propina a partir de la opción elegida. En móviles lentos el comensal puede tocar antes de que cargue la página; si no, el toque se perdía y se pagaba sin propina (detectado en la verificación de P2).
  - **Estado del pago sin cuenta:** `GET /v1/payments/:id?t=` con un token HMAC del id del pago (versión simplificada de la `guest_session` de ARCHITECTURE §11).
  - **Comisión de plataforma provisional:** 0,5 % del importe sin propina (`PLATFORM_FEE_BPS`, `PLATFORM_FEE_FIXED_CENTS`) hasta cerrar D-05.
  - **Worker en el mismo proceso** (`PROCESS_ROLE=all`): colas BullMQ con prefijo configurable (`QUEUE_PREFIX`; los tests usan uno propio) y relé del outbox cada 300 ms.
  - **Tablas `fake_*` en el esquema `public`** durante la PoC (ARCHITECTURE §16.7: separarlas antes de producción).
- **Consecuencias:**
  - P3 debe sustituir la regla de «una sola sesión» por asignaciones.
  - Los eventos SSE de la mesa no llegan al navegador directamente: habrá que pasarlos por la web QR (P3).

<a id="adr-022"></a>
## ADR-022: reparto de la cuenta, tiempo real y cobro en mostrador (P3)

- **Estado:** Aceptada (18-oct-2026). Sustituye la regla de «una sola sesión viva por cuenta» de ADR-021.
- **Decisión:**
  - **Asignaciones (`order_allocations`):** cada pago reserva su parte, sea un importe (`AMOUNT`) o unidades de una línea del TPV (`ITEM`, por `pos_line_id`).
    - Se crean con el pedido bloqueado (`FOR UPDATE`) y releyendo el estado en la misma transacción.
    - **Invariante:** pagado en el TPV + cobrado sin registrar + reservado vigente ≤ total.
    - Las reservas caducan con la sesión (15 min). Se liberan si el pago falla, caduca, se cancela o se sustituye, y pasan a `PAID` al capturarse.
  - **Modos (FR-PAY-02):**
    - `FULL`: lo disponible.
    - `EQUAL`: `ceil(total × partes/personas)`, limitado a lo disponible, para que la suma cubra el total.
    - `ITEMS`: unidades libres de cada línea.
    - `AMOUNT`: un importe ≤ lo disponible.
    - El cálculo de `EQUAL` y de la propina está en `packages/shared-types`, y lo usan tanto la API como la web QR.
  - **Propina:** la web QR envía `{percent}` o `{amount}` y la API la calcula sobre la parte de cada comensal (FR-PAY-03).
  - **Reintentos:** un nuevo intento desde **el mismo dispositivo** (cookie `cc_guest` → `guestSessionId`) sustituye sus sesiones anteriores. Los demás comensales no se ven afectados. El comensal también puede liberar su parte desde la página de estado (`POST /payments/:id/cancel`).
  - **Tiempo real:** pub/sub de Redis por local y SSE tanto en la web QR como en el panel. Se descarta WebSocket en el panel: SSE basta para avisos de un solo sentido y pasa por los mismos *route handlers* de Next (la API no se expone).
    - El evento solo avisa; el cliente vuelve a pedir la página (`router.refresh()`).
    - El flujo empieza con `ready`. Si no llega en 4 s, el cliente pasa a sondeo cada 3 s.
    - **Motivo:** el túnel rápido de Cloudflare (`trycloudflare.com`) no admite SSE: retiene el cuerpo de la respuesta, comprobado incluso con un servidor SSE mínimo. Con un túnel con nombre o en el MVP el SSE funciona directamente.
  - **QR dinámico (FR-QR-03):** token JWS compacto EdDSA (`QR_SIGNING_KEY`), caduca a los 5 min (`DYNAMIC_QR_TTL_SECONDS`). El nonce y el uso único se garantizan en la BD: fila del QR bloqueada, una sesión viva por QR y `CONSUMED` al capturar. No se usa Redis `SETNX`.
  - ~~**Cobro en mostrador** sin mesa, con importe libre y sin registro en el TPV.~~ *Sustituido por [ADR-023](#adr-023): el QR dinámico se genera desde la caja para una mesa.*
  - **Vista de sala (FR-MER-08):** estado por mesa (libre / con cuenta / pagando / pago parcial / pagada / caja sin conexión) y propinas del día (zona horaria de Madrid).
- **Consecuencias:**
  - Al pagar por importe o a partes iguales no se marcan platos; si alguien paga por platos después, el límite lo pone el importe disponible.
  - Si el TPV cobra una parte por su cuenta (efectivo), ComerceChat solo conoce el importe, no qué platos.

<a id="adr-023"></a>
## ADR-023: el QR dinámico se genera desde la caja para cada mesa («Cobrar con QR»)

- **Estado:** Aceptada (18-oct-2026). Sustituye el «cobro en mostrador» de ADR-022.
- **Contexto:** el producto pidió quitar la sección «Cobro en mostrador» del panel y que el cobro con QR dinámico fuera un botón en cada mesa del simulador de caja. Es lo que haría el camarero desde su TPV: pulsar «Cobrar con QR» en una mesa y enseñar el QR al cliente.
- **Decisión:**
  - `POST /v1/merchant/tables/:tableId/payment-qr` genera un QR de un solo uso por **lo que queda por pagar en la mesa** en ese momento (`availableCents`). Si había otro QR activo de esa mesa, se anula.
  - El token firma también la mesa: `{qrId, locationId, tableId, amountCents, exp, nonce}`.
  - **El pago se trata como cualquier otro pago de la mesa** (`splitMode=POS_QR`): reserva su importe en `order_allocations` con el pedido bloqueado, se registra en la cuenta del TPV y la cierra.
  - Si, entre que se genera el QR y se paga, los comensales pagan parte desde sus móviles y el importe ya no cabe, se rechaza con `PAYMENT_QR_OUTDATED`: el personal genera uno nuevo. Nunca se cobra de más.
  - **Simulador de caja:** cada mesa con saldo pendiente tiene «Cobrar con QR». El QR aparece en la tarjeta con «Anular QR» y pasa a «Cobrado con QR» en tiempo real. La API devuelve en `FakePosState` el último QR de cada mesa.
  - Se eliminan la página `/mostrador`, el endpoint por local y el evento `counter.updated`; todo va por `table.updated`.
- **Consecuencias:**
  - En la PoC no hay cobro sin mesa. FR-QR-02 (QR estático de mostrador) sigue fuera del alcance de la PoC.
  - **Pendiente:** el QR lleva el token firmado entero en la URL (~300 caracteres) y sale denso. Si cuesta escanearlo desde una pantalla, se puede usar un código corto en la URL y dejar la firma en la BD, como en los QR de mesa.

<a id="adr-024"></a>
## ADR-024: usuarios, puntos y cupones en la PoC (P4)

- **Estado:** Aceptada (19-oct-2026)
- **Decisión:**
  - **Acceso del comensal:** teléfono + código de un solo uso (6 cifras, 5 min). En Redis solo se guarda el hash del código.
    - 3 fallos bloquean el número 15 min; máximo 5 envíos por hora.
    - En la PoC el código va a la consola y a Mailpit (`ConsoleOtpSender`, D-04).
    - El número de demo `+34600000000` → `000000`, sin límite de envíos y nunca en producción.
  - **Sesión del comensal:** JWT de 30 días (`JWT_USER_TTL_SECONDS`) en una cookie httpOnly de la web QR, sin token de renovación (simplificación de la PoC frente a ARCHITECTURE §11). Va separado de los tokens del comercio por `typ`.
  - **Alta:** para crear la cuenta hay que aceptar las condiciones. Se comprueba **antes** de gastar el código. Marketing y «compartir datos con este comercio» son casillas aparte y sin marcar (REG-07, ADR-016).
  - **Puntos (FR-LOY-02):**
    - `floor(€ pagados sin propina ni cupón × puntos por euro)`.
    - Pagos de usuarios identificados: se acreditan por el outbox al capturarse. El justificante ya los muestra como guardados.
    - Pagos sin cuenta: se reclaman en 24 h con el token de estado del pago (`POST /me/claim`).
    - El índice único parcial `(payment_id) WHERE type='EARN'` garantiza una sola entrada aunque el webhook o la reclamación se repitan (criterio 3).
    - La retención (`hold_hours`) es 0 en los datos de prueba.
  - **Recompensas (FR-LOY-03):** se canjean con la cuenta de puntos bloqueada (`FOR UPDATE`). Generan un apunte `REDEEM` y un cupón de un solo uso.
  - **«Vuelve y te invitamos» (FR-CPN-01):** cupón emitido al primer apunte `EARN` del usuario en el comercio; uno por usuario y promoción (índice único). Solo una promoción activa de esta plantilla por comercio.
  - **Cupón en el pago:**
    - El cupón **cubre** parte de la cuenta: la asignación y el registro en el TPV llevan el importe completo, con `discount_cents` aparte.
    - El PSP cobra importe − descuento + propina.
    - La propina, la comisión de plataforma y los puntos se calculan sobre lo que paga el comensal.
    - El cupón se reserva de forma atómica en la misma transacción que el pago (`UPDATE … WHERE status disponible RETURNING`), se libera con las asignaciones si el pago no se completa y se canjea al capturarse (`UNIQUE(coupon_redemptions.coupon_id)`).
    - Para usar cupones hace falta sesión.
  - **Analítica (FR-ANA-01 reducido):** consultas directas a `payments`, con días en hora de Madrid y comparación con el periodo anterior de igual duración.
  - **Mejora progresiva en toda la web QR:** formularios nativos con *server actions* (propina, reparto, cupón, PSP simulado, alta). Un toque antes de que cargue el JavaScript no se pierde.
  - **E2E en navegador (`pnpm e2e`, Playwright):**
    - Durante la prueba fija `WEB_QR_BASE_URL` a localhost, para que todo el recorrido ocurra en el mismo dominio y la cookie valga; al terminar restaura el valor.
    - Calienta las páginas antes de empezar, porque Next en modo desarrollo compila en el primer acceso.
    - Recarga los datos de prueba.
- **Consecuencias:** el opcional de `StripeConnectProvider` queda para después de la PoC.

<a id="adr-025"></a>
## ADR-025: doble factor de los comercios con TOTP propio y alta de comercio, locales y mesas (M0)

- **Estado:** Aceptada (19-oct-2026)
- **Contexto:** [ADR-013](#adr-013) exige doble factor a OWNER y MANAGER, y la condición de «hecho» de M0 es que un comercio se registre con doble factor y cree un local con mesas. El proveedor de autenticación sigue abierto ([D-03](#d-03)): la prueba técnica de los gestionados no debe bloquear el alta.
- **Decisión:**
  - **Factor:** TOTP (RFC 6238: SHA-1, 6 dígitos, pasos de 30 s) con cualquier app de autenticación, implementado en la API (`auth/totp.ts`, probado con los vectores del RFC). Sin SMS: es más barato y no depende de D-04. Las passkeys para comercios se evalúan con D-03.
  - **Quién:** obligatorio para OWNER y MANAGER; STAFF solo si lo activa. Una sesión de OWNER o MANAGER sin doble factor se rechaza aunque el JWT sea válido, así que los tokens emitidos antes de M0 dejan de valer.
  - **Login en dos pasos:**
    - La contraseña correcta devuelve `MFA_REQUIRED` o `MFA_SETUP_REQUIRED` con un `mfaToken`, en lugar de la sesión.
    - El `mfaToken` es un JWT de 5 minutos con audiencia `merchant-mfa`. No vale como sesión y es de un solo uso: se revoca su `jti`.
    - El panel lo guarda en una cookie httpOnly (`cc_mfa`), nunca en el HTML.
  - **Alta del factor:**
    - El secreto, de 160 bits, se guarda cifrado con AES-256-GCM (`merchant_users.mfa_secret_enc`).
    - Mientras no se confirma con un código, queda pendiente en Redis 10 minutos.
    - Al activarlo se emiten **10 códigos de recuperación** de un solo uso. Solo se guarda su HMAC (`merchant_user_recovery_codes`) y se marcan como usados de forma atómica (`UPDATE … WHERE used_at IS NULL RETURNING`).
  - **Protección del segundo paso:**
    - Se admite ±1 paso de desfase de reloj.
    - Un mismo código no vale dos veces: `SET NX` por usuario y paso.
    - 5 fallos bloquean la cuenta 15 minutos.
    - Hay límite por IP (`merchantMfa`).
    - Activaciones, fallos y usos de códigos de recuperación quedan en auditoría.
  - **Registro (FR-MER-01):**
    - `POST /merchant/auth/register` crea el comercio en `ONBOARDING` y su OWNER (contraseña ≥ 10 caracteres). No abre sesión hasta activar el doble factor.
    - Un comercio en `ONBOARDING` no acepta pagos por QR.
    - En la PoC, el OWNER completa un **alta simulada ante el PSP** (`POST /merchant/psp/onboarding/simulate`, solo con `PAYMENT_PROVIDER=fake`), que lo pasa a `ACTIVE`. Con un PSP real lo hará el webhook de verificación (FR-MER-02, M1).
  - **Locales y mesas (FR-MER-03/04):**
    - OWNER y MANAGER dan de alta locales y mesas en bloque.
    - Las mesas se numeran a continuación de las existentes («Mesa N»), con el local bloqueado (`FOR UPDATE`), y cada una nace con su QR estático firmado.
    - `PosConnector.linkNewTables` (opcional) enlaza las mesas nuevas con la caja. El simulador crea su propia mesa y carga la carta por defecto. Con una caja real el emparejamiento es manual (FR-POS-05, M2).
  - **Cuentas de prueba:** los OWNER del seed tienen el doble factor activado con un secreto público y conocido (`JBSWY3DPEHPK3PXP`). `pnpm poc:totp` imprime el código del momento.
- **Alternativas descartadas:**
  - **OTP por SMS o email para comercios:** depende de D-04 y es vulnerable al SIM swapping.
  - **Esperar a D-03 para el doble factor:** bloquearía M0. El TOTP es estándar y portable a cualquier proveedor.
  - **Librería externa de TOTP:** son unas 60 líneas con `node:crypto`, verificables con los vectores del RFC.
  - **Saltarse el doble factor en local:** escondería errores de flujo y no probaría la condición de «hecho».
- **Consecuencias:**
  - Los E2E entran con el secreto de prueba: helper `test/merchant-session.ts` en la API y paso del código en Playwright.
  - La resolución del QR se cachea 30 s, así que un QR consultado mientras el comercio estaba en `ONBOARDING` puede tardar hasta 30 s en aceptar pagos.
  - Falta recuperar la cuenta sin códigos (reinicio del doble factor por soporte, FR-ADM) y gestionar los usuarios del comercio (FR-MER-05).

<a id="adr-026"></a>
## ADR-026: colas de trabajo en SQS detrás de `QueueService`; tareas periódicas en BullMQ (M0)

- **Estado:** Aceptada (19-oct-2026)
- **Contexto:** ARCHITECTURE prevé outbox → worker → SQS en el MVP; la PoC usaba BullMQ para todo ([ADR-018](#adr-018)). Hacía falta pasar a SQS sin tocar el dominio ni perder la PoC local.
- **Decisión:**
  - `QueueService` es una fachada con dos transportes (`queue/bullmq.transport.ts`, `queue/sqs.transport.ts`). `QUEUE_DRIVER=bullmq|sqs` elige el de las **colas de trabajo**: eventos del PSP, eventos de dominio del outbox y entrega del PSP simulado.
  - Las **tareas periódicas** (caducidad de sesiones, purga de claves, liberación de puntos) van siempre en BullMQ (`SCHEDULED_QUEUES`): SQS no programa tareas, y Redis ya está en la arquitectura.
  - **SQS:**
    - Colas estándar `<QUEUE_PREFIX>-<cola>` con su `-dlq`. Entrega «al menos una vez» y sin orden, cubierto por la regla de que todo procesador es idempotente.
    - El `jobId` de BullMQ no tiene equivalente: con SQS la deduplicación la garantizan los propios procesadores (`psp_event_id`, índices únicos).
    - Reintentos: el mensaje fallido se aplaza `backoffMs · 2^(n−1)` cambiando su visibilidad. Al agotar los intentos del trabajo se copia a la DLQ con el motivo y se borra.
    - La redrive policy de la cola (25 recepciones) es la red de seguridad si el proceso muere antes de moverlo.
    - Long polling (`SQS_WAIT_SECONDS`, 20 s por defecto). Los consumidores se cortan con `AbortController` al apagar.
  - **Local:** ElasticMQ (servicio `sqs` de docker compose, también en CI) y `SQS_CREATE_QUEUES=on` para crear colas y DLQ al arrancar.
  - **Producción:** se exige `QUEUE_DRIVER=sqs`, y `SQS_CREATE_QUEUES=on` está prohibido: las colas las crea Terraform. Ver `productionViolations` en `config/env.ts`. *(Con [ADR-030](#adr-030), quién crea las colas en un entorno de producción queda pendiente de [D-07](#d-07).)*
- **Alternativas descartadas:**
  - **LocalStack:** más pesado, y su imagen gratuita ha cambiado de condiciones. ElasticMQ solo hace SQS y es suficiente.
  - **Colas FIFO:** deduplicarían, pero limitan el rendimiento y no hacen falta con procesadores idempotentes.
  - **EventBridge Scheduler para las tareas periódicas:** otra pieza más sin beneficio mientras haya Redis.
- **Consecuencias:**
  - Test de integración `queue-sqs.e2e-spec`: reintentos, DLQ y un cobro completo pasando por las tres colas de trabajo.
  - `pnpm poc:up` sigue con BullMQ por defecto.
  - El contexto de traza no viaja aún en los mensajes: cada trabajo es una traza propia ([ADR-027](#adr-027)).

<a id="adr-027"></a>
## ADR-027: trazas con OpenTelemetry, redactadas y solo con padre (M0)

- **Estado:** Aceptada (19-oct-2026)
- **Decisión:**
  - **SDK y arranque:** OpenTelemetry Node SDK con `TELEMETRY=on`, exportando OTLP/HTTP (variables estándar `OTEL_*`). `main.ts` arranca la telemetría y **después** importa la app (`server.ts`), porque los hooks de ESM solo instrumentan lo que se importa tras registrarlos.
  - **Instrumentación:** HTTP, Express, Postgres e ioredis. La de `nestjs-core` no se usa porque no cubre Nest 12; las rutas ya salen de Express.
  - **Cada trabajo de cola abre su span** (`process <cola> <trabajo>`, `QueueService`), así que las consultas de los workers se ven aunque no vengan de una petición.
  - **Sin ruido:** Postgres, Redis y las peticiones HTTP salientes solo generan spans dentro de otro span. Así, el sondeo del outbox (cada 300 ms) y el long polling de SQS no crean trazas sueltas.
  - **Privacidad:** las trazas salen del sistema, así que:
    - se redacta la query de las URL (el token de estado del pago va en `?t=`);
    - Postgres sin parámetros (`enhancedDatabaseReporting: false`);
    - Redis solo con el nombre del comando, porque sus argumentos incluyen claves con hashes y valores como el secreto TOTP pendiente cifrado.
  - **Local:** Jaeger opcional (`docker compose --profile observability up -d`, http://localhost:16686).
- **Verificado:** un cobro completo genera 7 trazas (3 peticiones, 3 trabajos de cola y la tarea de mantenimiento), sin trazas sueltas y sin el token en ningún atributo.
- **Pendiente:**
  - **Sentry:** requiere cuenta; se conectará al mismo SDK.
  - ~~**Propagar el contexto de traza en los mensajes de cola**~~ *Hecho en MS F1.7 (12-nov-2026): cada trabajo y cada evento del outbox llevan `traceparent`, y webhook, captura y eventos de dominio forman una sola traza (comprobado en Jaeger). Ver [MIGRACION.md](MIGRACION.md).*
  - **Métricas y logs estructurados.**

<a id="adr-028"></a>
## ADR-028: auditoría de solo inserción forzada en la base de datos y ligada al comercio (M0)

- **Estado:** Aceptada (19-oct-2026)
- **Contexto:** `audit_logs` y `user_consents` eran de solo inserción por convención del código. El comercio no podía ver quién había entrado en su cuenta ni qué había cambiado, que es lo primero que se mira ante un acceso sospechoso, ahora que hay doble factor.
- **Decisión:**
  - **Solo inserción en la base de datos:** triggers `BEFORE UPDATE OR DELETE` que lanzan un error en `audit_logs` y `user_consents` (migración `0005`, añadido a mano como en [ADR-019](#adr-019)).
    - `TRUNCATE` no dispara triggers de fila; solo lo usa el seed local.
    - En producción el rol de la aplicación no tendrá permiso de `TRUNCATE`.
    - `points_ledger_entries` no entra aún, porque la liberación `PENDING → AVAILABLE` actualiza el estado; se revisará con FR-LOY en M3.
  - **Ligada al comercio:** `audit_logs.merchant_id`, sin clave foránea porque es histórico, con índice `(merchant_id, id)`. Todas las acciones del panel, del doble factor y los avisos de pago lo rellenan. El login fallido no, porque no se sabe de qué comercio es.
  - **Nuevo evento:** se audita también el cierre de sesión.
  - **Registro de actividad:**
    - `GET /merchant/audit`, solo para el OWNER, con paginación por cursor sobre el id (UUIDv7) y la IP recortada (`a.b.c.x`).
    - En el panel, página **Actividad**, con los fallos de doble factor y las anomalías de pago resaltados.
- **Consecuencias:** el visor completo del backoffice interno (FR-ADM-05) sigue en M5. La retención de 6 años (NFR-09) se aplicará con la política de copias en AWS.
- **Actualización (MS F1.5, [ADR-029](#adr-029)):** los contextos ya no escriben en `audit_logs`. `AuditEmitter` guarda `AuditRecorded.v1` en el outbox dentro de la transacción del cambio y el contexto audit lo inserta con su id (idempotente); los triggers siguen en `audit.audit_logs` e `identity.user_consents`. La entrada nunca se pierde; aparece en el registro con menos de un segundo de retraso.

<a id="adr-029"></a>
## ADR-029: microservicios dentro del monorepo, como base para experimentos DevOps

- **Estado:** Aceptada (12-nov-2026). Sustituye a [ADR-009](#adr-009). Plan de ejecución en [MIGRACION.md](MIGRACION.md).
- **Contexto:**
  - El proyecto es un portfolio y se quiere una base de microservicios sobre la que hacer experimentos DevOps.
  - ADR-009 descartó los microservicios por el coste operativo con un equipo pequeño. Ese coste se asume a propósito: es justo lo que se quiere practicar.
  - No hay datos de producción [HECHO], así que mover tablas y rehacer migraciones no exige migrar datos en vivo.
  - El código actual no cumple la regla de ARCHITECTURE §5 de no acceder a tablas de otro módulo [HECHO] (MIGRACION §2.3).
- **Decisión:**
  - **Monorepo:** se mantiene pnpm + Turborepo. Los servicios viven en `services/*` y se construyen y despliegan por separado.
  - **Servicios:** `identity`, `merchant-venues`, `table-payments`, `loyalty`, `realtime`, `audit`, `analytics`, y los simuladores `fake-psp` y `fake-pos`. Delante, un gateway (nginx, [ADR-030](#adr-030)).
  - **El núcleo del dinero no se parte.** `table-payments` agrupa pago, cuenta de la mesa, reparto, QR dinámico y ciclo de vida del cupón, con las mismas transacciones ACID que hoy (ADR-015, ADR-022, ADR-024). No hay sagas en el camino del dinero.
  - **Datos:** un clúster PostgreSQL con una base de datos y un esquema y un rol por servicio, sin claves foráneas entre esquemas. Redis compartido con prefijo por servicio.
  - **Comunicación:**
    - síncrona en REST/JSON, por rutas `/internal/*` que el gateway no expone;
    - asíncrona con el outbox de cada servicio y una cola por consumidor;
    - los eventos son versionados y llevan los datos que necesitan sus consumidores.
  - **Auditoría:** cada servicio la escribe en su outbox dentro de su transacción, y `audit` la inserta de forma idempotente.
  - **Fronteras verificadas en CI** con dependency-cruiser antes de extraer ningún servicio (fase F1).
  - **DevOps:** queda fuera de la migración salvo lo mínimo para desplegar ([ADR-030](#adr-030)). El resto son recomendaciones (MIGRACION §9).
- **Alternativas descartadas:**
  - **Seguir con el monolito modular (ADR-009):** no sirve para el objetivo del portfolio.
  - **Un repositorio por servicio:** obliga a versionar y publicar los paquetes compartidos y complica los cambios que tocan varios servicios.
  - **Partir pagos, reparto y cupones en servicios distintos con sagas:** el canje del cupón y la protección contra cobrar dos veces dejarían de ser atómicos.
  - **Una base de datos física por servicio:** más coste local sin ganancia para el objetivo; el rol por esquema ya impone la frontera.
  - **gRPC:** se mantiene REST/JSON, como hoy.
- **Consecuencias:**
  - El trabajo funcional se para hasta terminar la migración, que va antes de M1 (ROADMAP, hito MS).
  - La aparición en `audit_logs` y el modelo de lectura de `analytics` pasan a ser eventuales.
  - La validación de sesiones se hace con una llamada a `identity`, lo que añade latencia de red (NFR-03).
  - **Cupones (concretado en F1):** loyalty los emite (`coupon_issuances`) en la misma transacción que su apunte de puntos y publica `CouponIssued.v1`; table-payments crea el cupón con ese id y guarda su estado (reserva y canje atómicos en la transacción del pago). Tras el commit, loyalty lo entrega también directamente, de forma idempotente, para que se vea al momento; el evento es la garantía.
  - **Registro de comercio (concretado en F1):** en dos pasos; merchant-venues crea el comercio en `ONBOARDING` e identity, su OWNER. Si falla el segundo, queda un comercio sin usuarios que no acepta pagos.
  - **Roles de base de datos por servicio:** llegan al extraer cada servicio (F3–F6). En F1 los esquemas ya están separados y sin claves foráneas entre ellos, y el outbox y la idempotencia viven en un esquema común `platform`.
  - Los simuladores se convierten en servicios HTTP, como lo serán los adaptadores reales. Esto resuelve la separación de las tablas `fake_*` (ARCHITECTURE §16.7).

<a id="adr-030"></a>
## ADR-030: despliegue del MVP en Kubernetes local (k3d) con nginx como gateway

- **Estado:** Aceptada (12-nov-2026). Sustituye a [ADR-011](#adr-011).
- **Contexto:**
  - Con [ADR-029](#adr-029) hay varios servicios que desplegar y el objetivo es experimentar con DevOps sobre Kubernetes.
  - ADR-011 fijaba AWS eu-south-2, Terraform y ECS Fargate sin Kubernetes, y Cloudflare como CDN/WAF. Ninguna de esas piezas tiene cuenta todavía [HECHO] (ROADMAP M0).
- **Decisión:**
  - **El MVP se despliega en Kubernetes local con k3d.** Además se mantienen `pnpm dev` y docker compose para el desarrollo.
  - **Gateway:** nginx con configuración declarativa (`deploy/gateway/nginx.conf`), el mismo fichero en docker compose y en Kubernetes. Enruta `/v1` por ruta concreta, no expone `/internal/*`, desactiva el buffer en las rutas SSE y deja pasar intactos el cuerpo de los webhooks (ADR-015) y las cabeceras de IP de los BFF (ADR-021).
  - **Clúster k3d:**
    - registro de imágenes propio de k3d;
    - Traefik desactivado;
    - solo `web-qr` y `merchant-panel` publicados en `127.0.0.1`. La API no se publica (ADR-021).
  - **Manifiestos:** Kustomize con base y overlay `local`. Cada servicio tiene un `Deployment` HTTP, otro para workers si los tiene y un `Job` de migración. La infraestructura (Postgres+PostGIS, Redis, ElasticMQ, Mailpit) va dentro del clúster en el overlay local.
  - **El overlay local usa los simuladores** (ADR-018), así que no es un entorno de producción: las comprobaciones de `NODE_ENV=production` siguen como están.
  - **Nube:** el proveedor, la región, la infraestructura como código y el CDN/WAF quedan abiertos en [D-07](#d-07).
- **Alternativas descartadas:**
  - **ECS Fargate (ADR-011):** sin Kubernetes no sirve para el objetivo.
  - **kind o minikube:** k3d es más ligero y trae registro de imágenes y balanceador integrados.
  - **Gateway propio en Node:** más código que mantener. nginx resuelve el enrutado por configuración.
  - **Traefik (el ingress por defecto de k3d):** se elige nginx.
- **Consecuencias:**
  - La condición de «hecho» de M0 pasa de «en staging en AWS» a «en el despliegue en k3d».
  - Terraform y el despliegue en ECS salen de M0.
  - Lo que ARCHITECTURE §14 atribuía a AWS (RDS Multi-AZ, KMS, Secrets Manager, copias en otra región, WAF) queda pendiente de D-07. En local, los secretos van en `Secret` de Kubernetes generados desde `.env.local`.
  - NFR-06 (datos en la UE) se mantiene como requisito; la región concreta depende de D-07.

---

## Decisiones abiertas

> **Impacto en la PoC:** D-01, D-02, D-04 y D-05 **no bloquean** la PoC (se simulan). D-03 se resuelve en M0; la PoC usa autenticación local. D-06 está cerrada (ADR-019). D-07 no bloquea la migración a microservicios, que se despliega en k3d (ADR-030).

<a id="d-01"></a>
### D-01: qué PSP usar en el MVP

- **Candidatos:**
  - Stripe Connect.
  - Adyen for Platforms.
  - Monei (español, Bizum nativo).
  - Como reserva: Mangopay, Paycomet.
- **Criterios:**
  1. Bizum disponible.
  2. Precio por método (tarjeta EEE estándar, premium, internacional, Bizum, Alipay+).
  3. Alta de comercios alojada y rápida.
  4. Comisión de plataforma nativa.
  5. Reservas de fondos y política de chargebacks.
  6. Plazo de liquidación.
  7. Mínimos de volumen.
  8. Calidad de la API y del modo de pruebas.
  9. Tap to Pay en España.
  10. Alipay+/WeChat Pay.
- **Se desbloquea con:** condiciones escritas de los 3 candidatos y la opinión legal sobre el flujo de fondos.
- **Fecha objetivo:** antes de empezar el hito M1.

<a id="d-02"></a>
### D-02: qué softwares de caja integrar primero (1–2)

- **Criterios:**
  1. Implantación en los restaurantes del piloto.
  2. API pública o de socios (leer cuenta, enviar pedido, registrar pago).
  3. Entorno de pruebas disponible.
  4. Cumplimiento de VeriFactu.
- **Se desbloquea con:** evaluación técnica de las APIs de 2–3 fabricantes.
- **Fecha objetivo:** antes del hito M2.

<a id="d-03"></a>
### D-03: proveedor de autenticación

- **Opciones:** gestionado (AWS Cognito, Auth0, Clerk) o propio (NestJS + librerías de passkeys + proveedor de OTP).
- **Criterios:**
  1. Soporte de OTP por WhatsApp.
  2. Passkeys.
  3. Coste por usuario activo a 100 k usuarios.
  4. Residencia de datos en la UE.
  5. Riesgo de dependencia del proveedor.
- **Se desbloquea con:** prueba técnica de 2 días en el hito M0. En la PoC se usa autenticación local (JWT + OTP por consola) detrás de la interfaz `AuthProvider`, para no condicionar la elección.

<a id="d-04"></a>
### D-04: proveedor de WhatsApp Business y de SMS

- **Opciones:** Twilio, 360dialog, Infobip, MessageBird.
- **Criterios:**
  1. Precio por conversación en España.
  2. Plantillas de OTP.
  3. API.
  4. Residencia de datos.
- **Se desbloquea con:** ofertas y pruebas en el hito M1 (para OTP) y en el M4 (para campañas).

<a id="d-05"></a>
### D-05: cálculo de la comisión de plataforma

- **Opciones:** porcentaje sobre el importe, fijo por operación, cuota periódica por comercio o una combinación (los valores los fija negocio).
- **Impacto técnico:** `merchants.plan_id`, cálculo de `platform_fee_cents` en `fees.ts` y, si hay cuota periódica, su facturación (posiblemente vía el sistema de suscripciones del PSP o una herramienta externa).
- **En la PoC:** `PLATFORM_FEE_BPS` y `PLATFORM_FEE_FIXED_CENTS` (ADR-021).

<a id="d-06"></a>
### D-06: ORM (Prisma o Drizzle). **Cerrada → Drizzle ([ADR-019](#adr-019))**

- **Criterios:**
  1. Control sobre el SQL generado (bloqueos `FOR UPDATE`, PostGIS).
  2. Calidad de las migraciones.
  3. Rendimiento.
- **Se desbloquea con:** prueba técnica en la primera semana de la PoC (ADR-017).

<a id="d-07"></a>
### D-07: nube, región y CDN/WAF fuera del entorno local

- **Contexto:** [ADR-030](#adr-030) sustituye a ADR-011. El MVP se despliega en Kubernetes local (k3d) y no hay elegido destino en la nube.
- **Qué hay que decidir:**
  - el proveedor de nube y su Kubernetes gestionado;
  - la región (NFR-06: datos en la UE);
  - la infraestructura como código;
  - los servicios gestionados (base de datos, Redis, colas, secretos y claves);
  - el CDN/WAF.
- **Criterios:**
  1. Residencia de datos en la UE (NFR-06).
  2. Kubernetes gestionado compatible con los manifiestos de `deploy/k8s`.
  3. Base de datos con recuperación a un punto en el tiempo y copias en otra región de la UE.
  4. Colas compatibles con `QueueService` (ADR-026).
  5. Coste para un portfolio.
- **Se desbloquea con:** la decisión del propietario de desplegar fuera del entorno local. Mientras tanto no bloquea ningún hito.

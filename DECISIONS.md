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
> - [CONTEXT.md](CONTEXT.md)

---

<a id="adr-001"></a>
## ADR-001: MVP reducido para hostelería, no superapp

- **Estado:** Aceptada (17-oct-2026)
- **Contexto:** la idea original era un "WeChat español" (pagos, envíos entre usuarios, descubrimiento, reservas, delivery, mini-apps). El análisis ([CONTEXT.md](CONTEXT.md)) concluye:
  - En España el pago ya está resuelto: tarjeta + NFC + Bizum, que tiene 30,6 M de usuarios y funciona en tienda desde mayo de 2026.
  - Sin licencia, el margen de pagos es mínimo.
  - El problema real está en la experiencia en mesa del restaurante y en la relación comercio–cliente.
- **Decisión:** el MVP es *pedir, pagar y volver* para restaurantes con servicio en mesa (ticket 25–60 €), en 2 barrios de Madrid. La superapp queda como visión a largo plazo y solo se aborda si hay densidad de comercios.
- **Alternativas descartadas:**
  - Superapp completa por fases.
  - Varios segmentos a la vez (cafeterías, peluquerías, gimnasios, hoteles).
  - Nicho de turistas chinos como lanzamiento.
- **Consecuencias:**
  - El alcance excluido está listado en SPEC §3.2.
  - Cualquier función nueva debe justificar su impacto en uno de los KPI de salida de la fase en curso (ROADMAP).
  - Cafeterías excluidas porque el ticket pequeño destruye el margen: en un café de 2,50 €, la comisión supone ~11 %.

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
  - Coste por transacción más alto que el TPV bancario del comercio: hay que compensarlo con valor (rotación, propinas, repetición).
  - Dependencia del PSP; se mitiga con la interfaz `PaymentProvider` y un segundo PSP preparado a partir de ~200 comercios.
  - Reconsiderar una licencia propia o la figura de agente solo con más de 1.000–2.000 comercios (fase 24–36 m).

<a id="adr-004"></a>
## ADR-004: sin monedero, envíos entre usuarios ni cashback en dinero

- **Estado:** Aceptada
- **Contexto:**
  - Un saldo prepago es dinero electrónico (requiere licencia de entidad de dinero electrónico, con capital mínimo de 350 k€).
  - Los envíos entre usuarios son un servicio de pago.
  - Bizum ya cubre los envíos entre personas: 1.237 M de operaciones en 2025.
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
- **Decisión:** en el MVP, cada programa de fidelización pertenece a un único comercio. La coalición de barrio se aborda en la fase 12–24 m, tras la opinión legal.
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
- **Contexto:** sin integración, el camarero tiene que teclear el importe. Eso añade fricción y el valor del producto cae a la mitad. Es el foso defensivo técnico frente a competidores (Honei, Qamarero, etc.).
- **Decisión:**
  - Integrar 1–2 softwares de caja de hostelería populares en los barrios objetivo antes del piloto profesional, mediante la interfaz `PosConnector`.
  - Mantener `ManualPosConnector` como modo degradado.
- **Consecuencias:**
  - Es la tarea técnica de mayor riesgo del roadmap (hito M2).
  - Requiere acuerdos comerciales con los fabricantes.

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

- **Estado:** Aceptada
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

- **Estado:** Aceptada
- **Decisión:**
  - Infraestructura en AWS eu-south-2, con copias de seguridad en otra región de la UE.
  - Terraform y ECS Fargate (sin Kubernetes en el MVP).
  - Cloudflare como CDN y WAF.
- **Alternativas descartadas:**
  - GCP europe-southwest1 (Madrid): igual de válida; se elige AWS por la madurez de RDS, SQS y KMS y por la familiaridad del mercado.
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

<a id="adr-014"></a>
## ADR-014: Alipay+/WeChat Pay y carta multiidioma solo en fase 2 y solo vía PSP

- **Estado:** Aceptada
- **Contexto:**
  - En 2025 llegaron ~795.500 turistas chinos a España y el 27 % visita Madrid.
  - Alipay+ ya está presente vía BBVA, Sabadell, ABANCA/Starpay y El Corte Inglés.
  - Es una funcionalidad útil para locales del centro, pero no un segmento de lanzamiento.
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
  - Mientras tanto hace falta algo tangible que enseñar a hosteleros e inversores, más convincente que un Figma, y validar pronto las partes técnicas de más riesgo (dividir la cuenta en paralelo, idempotencia, canje atómico, tiempo real).
- **Decisión:**
  - Construir en 3–4 semanas una PoC que funciona entera en local (docker compose + `pnpm dev`), con el alcance de [SPEC §3.3](SPEC.md#poc).
  - Usar el mismo monorepo, stack y módulos que el MVP ([ARCHITECTURE §16](ARCHITECTURE.md#poc-local)), para que el código evolucione hacia el MVP.
- **Alternativas descartadas:**
  - Prototipo desechable (no-code o un único Next.js con todo dentro): más rápido, pero no valida la arquitectura y obliga a reescribir.
  - Esperar a cerrar D-01 y D-02: retrasa el feedback de 1 a 2 meses.
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

---

## Decisiones abiertas

> **Impacto en la PoC:** D-01, D-02, D-04 y D-05 **no bloquean** la PoC (se simulan). D-03 (en su versión local) y D-06 se resuelven en la primera semana de la PoC.

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
- **Se desbloquea con:** ofertas escritas de los 3 candidatos (acción 9 del plan de 90 días) y la opinión legal sobre el flujo de fondos.
- **Fecha objetivo:** antes de empezar el hito M1.

<a id="d-02"></a>
### D-02: qué softwares de caja integrar primero (1–2)

- **Criterios:**
  1. Cuota de mercado en los barrios objetivo (según el recuento de la acción 3 del plan de 90 días).
  2. API pública o de socios (leer cuenta, enviar pedido, registrar pago).
  3. Disposición a una alianza de canal.
  4. Cumplimiento de VeriFactu.
- **Se desbloquea con:** mapeo de los barrios y conversaciones con 2–3 fabricantes.
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
### D-05: modelo de precios para el comercio

- **Opciones:**
  - (a) Plan SaaS de 49–79 €/mes + margen sobre pagos de ~0,3–0,5 %.
  - (b) Sin cuota, con +1 % por transacción.
- **Se desbloquea con:** test A/B con los primeros 30 comercios y el dato real de lo que pagan hoy en su TPV bancario (acción 7 del plan de 90 días).
- **Impacto técnico:** `merchants.plan_id`, cálculo de `platform_fee_cents` y facturación de la cuota SaaS (posiblemente vía el sistema de suscripciones del PSP o una herramienta externa).

<a id="d-06"></a>
### D-06: ORM (Prisma o Drizzle)

- **Criterios:**
  1. Control sobre el SQL generado (bloqueos `FOR UPDATE`, PostGIS).
  2. Calidad de las migraciones.
  3. Rendimiento.
- **Se desbloquea con:** prueba técnica en la primera semana de la PoC (ADR-017).

# ROADMAP: hoja de ruta de desarrollo de ComerceChat

> **Estado:** borrador v0.2 (17-oct-2026). Añade la fase PoC local (§2). El mes 0 es el inicio del trabajo a tiempo completo con CTO.
>
> **Documentos relacionados:**
> - Requisitos en [SPEC.md](SPEC.md).
> - Arquitectura en [ARCHITECTURE.md](ARCHITECTURE.md).
> - Decisiones en [DECISIONS.md](DECISIONS.md).
> - Plan de negocio de 90 días en [CONTEXT.md › Plan de 90 días](CONTEXT.md#plan-90-dias).
>
> Los objetivos numéricos son **[HIPÓTESIS]** que se recalibran con los datos del piloto.

---

## 1. Fases y KPIs de salida

| Fase | Objetivo | Entregables de producto y tecnología | KPIs de salida |
|---|---|---|---|
| **Semanas 1–4** · PoC local | Demo tangible + reducir el riesgo técnico sin depender de terceros (ADR-017) | Hitos **P1–P4** (§2): monorepo, simuladores de PSP y de caja, web QR, dividir cuenta, puntos, cupones, panel básico | Los 6 criterios de éxito de [SPEC §3.3](SPEC.md#poc); demo vista por ≥ 5 hosteleros |
| **0–3 meses** · Validación | Validar el dolor y la disposición a pagar; elegir PSP y software de caja | Hitos **M0–M1**: base técnica, web QR + pago con importe manual, panel mínimo. Prototipo en Figma probado. Piloto en 3–5 locales | ≥10 cartas de intención; ≥3 locales en uso real; ≥15 % de mesas pagadas por QR en esos locales; D-01 y D-02 cerradas |
| **3–6 meses** · Piloto profesional | MVP completo en 2 barrios | Hitos **M2–M5**: integración con el software de caja, dividir cuenta y propinas, puntos y cupones, CRM y analítica, endurecimiento y pentest | 30–50 comercios activos; volumen ≥ 250 k€/mes; churn < 3 %/mes; ≥ 20 % de pagadores registrados; NPS de comercios > 40 |
| **6–12 meses** · Ajuste producto-mercado | ROI demostrable y venta repetible | **App nativa** (Expo); campañas por WhatsApp; **2.ª integración** con software de caja; **Tap to Pay**; **carta multiidioma + Alipay+/WeChat Pay vía PSP** (ADR-014); App Clip / Instant App (evaluar); segundo PSP preparado | 150–250 comercios; 2–3 M€/mes de volumen; ARR ≥ 250–350 k€; payback ≤ 12 meses; repetición de usuarios a 60 días ≥ 30 % |
| **12–24 meses** · Escalar Madrid + 2.ª ciudad | Densidad y efecto red local | **Coalición de puntos de barrio** (tras opinión legal, ADR-005); descubrimiento "Cerca" mejorado; motor de campañas avanzado; patrocinios de marcas de bebida (campañas cofinanciadas); multi-ciudad (Barcelona o Valencia); almacén de datos (BigQuery o ClickHouse); despliegue blue/green | 800–1.200 comercios; ARR 1–1,5 M€; retención neta de ingresos de comercios ≥ 100 %; 150–300 k usuarios registrados |
| **24–36 meses** · Plataforma | Multi-ciudad y apertura | API pública y webhooks salientes; reservas y pedidos para llevar; publicidad local / comercio destacado; valorar figura de agente o licencia de entidad de pago; valorar Portugal; certificación ISO 27001 / SOC 2 | 2.500–4.000 comercios; ARR 3–5 M€; margen de contribución positivo por cohorte |

<a id="poc"></a>
## 2. PoC local (semanas 1–4)

Alcance en [SPEC §3.3](SPEC.md#poc) y arquitectura en [ARCHITECTURE §16](ARCHITECTURE.md#poc-local). La PoC se desarrolla **en paralelo** con las acciones de negocio de las semanas 1–6 del plan de 90 días (entrevistas, ofertas de PSP, opinión legal) y no depende de ninguna de ellas.

### P1: base local (semana 1) · ✅ completado el 17-oct-2026
- Monorepo (pnpm + Turborepo), docker compose (Postgres+PostGIS, Redis, Mailpit), `pnpm poc:up`.
- Cerrar **D-06** (ORM) → Drizzle, [ADR-019](DECISIONS.md#adr-019). Primeras migraciones: `merchants`, `merchant_users`, `merchant_locations`, `tables`, `qr_codes`, `users`, `user_consents`, `audit_logs`, `outbox_events`.
- NestJS base con OpenAPI/Swagger, autenticación local de comercio (`AuthProvider` local), módulos `merchants`, `venues` y `qr`.
- Script de datos de prueba (§16.4 de ARCHITECTURE).
- CI mínima: lint + tests.
- **Hecho cuando:** `pnpm poc:up` levanta todo desde cero y el panel lista las mesas del comercio de prueba con sus QR.

### P2: QR, cuenta y pago simulado (semana 2) · ✅ completado el 18-oct-2026
- `FakePosConnector` + página `/pos-simulator`.
- Web QR: cabecera de identidad, cuenta de la mesa, propina.
- `FakePaymentProvider` con página de pago simulada y webhooks firmados.
- Tablas `payments`, `transactions` y `psp_webhook_events`; worker BullMQ; justificante.
- Registro del pago en el simulador de caja.
- **Hecho cuando:** desde un móvil en la misma wifi se paga una mesa y el simulador de caja la marca como pagada.
- **Resultado:** verificado en un iPhone simulado contra la app local (cuenta → propina 10 % → 3DS → justificante → cuenta cerrada en el simulador) y con tests E2E (webhook ×10 → un solo cobro; tarjeta rechazada; caja caída). Desde un móvil real se prueba con el túnel (`pnpm poc:tunnel`), no por wifi: en WSL2 la red local no llega. Decisiones de implementación en [ADR-021](DECISIONS.md#adr-021).

### P3: dividir la cuenta, tiempo real e idempotencia (semana 3) · ✅ completado el 18-oct-2026
- `order_allocations`, dividir a partes iguales, por artículos o por importe.
- SSE por mesa; vista del camarero en el panel.
- Modo caos del PSP simulado; QR dinámico de cobro (generado desde la caja para cada mesa, ADR-023).
- Tests de concurrencia y de idempotencia (criterios 2 y 3).
- **Hecho cuando:** 4 móviles pagan la misma mesa a la vez sin pagar dos veces ninguna parte, y el panel se actualiza en < 3 s.
- **Resultado:** verificado a través del túnel con 4 iPhones simulados sobre la Mesa 2 (65,60 €): dos piden el mismo plato a la vez y solo uno lo consigue; los otros pagan a partes iguales y por importe; un 5.º móvil y la **Sala** del panel se actualizan solos. La caja recibió exactamente 65,60 € en 4 pagos sin duplicados y la Sala mostró «Pagada» **0,6 s** después del último pago. Cobro con QR desde la caja («Cobrar con QR» en cada mesa del simulador, [ADR-023](DECISIONS.md#adr-023)): «Cobrado» en 0,8 s y la cuenta de la mesa cerrada. Tests E2E con el modo caos (webhooks retrasados y duplicados) estables en ejecuciones repetidas. Decisiones en [ADR-022](DECISIONS.md#adr-022).

### P4: usuarios, puntos, cupones y panel (semana 4)
- Registro tras el pago con OTP por consola y consentimientos.
- Registro de puntos, recompensa → cupón, una plantilla de promoción, canje atómico.
- Panel de analítica básico (FR-ANA-01 reducido).
- Test E2E con Playwright del recorrido completo; test de 100 canjes paralelos.
- Guion de demo de 5 minutos.
- (Opcional) `StripeConnectProvider` en modo de pruebas con túnel.
- **Hecho cuando:** se cumplen los criterios 1–5 de SPEC §3.3. El criterio 6 (feedback de ≥ 5 hosteleros) se completa en las 2 semanas siguientes.

## 3. Hitos técnicos del MVP (meses 0–6)

Cada hito termina con una demostración en staging y una lista de requisitos de SPEC cubiertos. **Parten del código de la PoC**: los simuladores se mantienen como dobles de prueba.

### M0: de la PoC a staging (semanas 1–2 tras la PoC)
- Terraform para staging en AWS, CI completa (Semgrep, gitleaks, Dependabot), despliegue en ECS.
- Doble factor para comercios, módulo `audit` completo, outbox → SQS.
- Observabilidad mínima (Sentry + OpenTelemetry).
- Prueba técnica para cerrar **D-03** (autenticación definitiva).
- Modelado de amenazas STRIDE del flujo de pago.
- **Hecho cuando:** un comercio de pruebas se registra con doble factor y crea un local con mesas en staging.

### M1: QR y pago con importe manual (semanas 3–7)
- **Requiere D-01 (PSP) cerrada.** Parte de lo que la PoC ya tiene (QR, web QR, webhooks, propina, justificante); el trabajo principal es el adaptador real del PSP y su alta de comercios.
- `PaymentProvider` (una implementación) + alta del comercio en el flujo alojado del PSP (FR-MER-02).
- Módulo `qr`: estáticos de mesa y mostrador, dinámicos, revocación y PDF (FR-QR-01…06).
- Web QR: cabecera de identidad, importe introducido por el STAFF (`ManualPosConnector`), propina, pago (tarjeta, Apple Pay, Google Pay, Bizum si está disponible), justificante (FR-PAY-01, 03–06, 10–11).
- Webhooks idempotentes, `transactions`, conciliación diaria (ADR-015).
- Reembolsos (solo OWNER) y gestión básica de disputas (FR-PAY-07/08).
- Vista del camarero con el estado de las mesas (FR-MER-08).
- **Hecho cuando:** un pago real (en el modo en vivo del PSP) en un local socio llega al IBAN del comercio con la comisión de plataforma descontada, y la conciliación cuadra.
- **→ Piloto en 3–5 locales** (fin de la fase 0–3).

### M2: integración con el software de caja, dividir cuenta y pedido (semanas 7–12)
- **Requiere D-02 cerrada.** Dividir la cuenta y el tiempo real ya existen desde la PoC (P3); el trabajo principal es el adaptador real del software de caja y el pedido desde la mesa.
- `PosConnector` + adaptador del primer software de caja: leer la cuenta, la carta, enviar pedidos, registrar pagos y emparejar mesas (FR-POS-01…06).
- Cuenta en tiempo real (SSE), `order_allocations`, dividir a partes iguales, por artículos o por importe (FR-ORD-01, FR-PAY-02).
- Pedido desde la mesa con estados (FR-ORD-02…04).
- Modo degradado automático cuando el software de caja cae.
- **Hecho cuando:** 4 comensales pagan la misma mesa en paralelo sin pagar dos veces ninguna parte, y el software de caja cierra la mesa.

### M3: usuarios, puntos y cupones (semanas 10–15)
- Autenticación de usuarios: OTP, passkeys, Apple/Google; consentimientos (FR-USR-*, ADR-013, ADR-016).
- Reclamar puntos tras el pago como invitado (FR-USR-02).
- Fidelización: programas, registro de solo-inserción, PENDING→AVAILABLE, recompensas, anulación por reembolsos y disputas (FR-LOY-*).
- Cupones y promociones con plantillas; reserva y canje atómicos (FR-CPN-01…06).
- Pase de Wallet (FR-USR-06).
- Valoraciones (FR-REV-*).
- **Hecho cuando:** las pruebas de concurrencia sobre canjes y puntos pasan (100 peticiones paralelas sobre el mismo cupón → exactamente 1 canje).

### M4: panel con CRM, analítica y notificaciones (semanas 13–18)
- CRM: clientes con consentimiento, segmentos, ficha, exportación CSV, alertas (FR-CRM-*).
- Analítica del comercio: panel de inicio, pagos y conciliación, propinas, promociones (FR-ANA-*, FR-CPN-07).
- Notificaciones: push, email, OTP por WhatsApp; campañas por WhatsApp opcionales (FR-NOT-*; requiere D-04).
- Eventos de producto en PostHog (SPEC §9).
- Backoffice interno (FR-ADM-*) y reglas iniciales del módulo `risk`.

### M5: endurecimiento y lanzamiento del piloto profesional (semanas 18–24)
- Pentest externo y corrección de hallazgos; revisión de la app según MASVS L1.
- Pruebas de carga (objetivo: pico de 50 pagos/s y 2.000 conexiones SSE) y presupuesto de rendimiento de la web QR (NFR-01).
- Auditoría de accesibilidad WCAG 2.1 AA (NFR-04).
- Guías de incidentes, alertas y prueba de restauración de copias de seguridad.
- DPIA, términos y política de privacidad finales (en [CONTEXT.md](CONTEXT.md)).
- **App de usuario v1** (Expo) en TestFlight / beta de Play (FR-APP-*), si hay capacidad. Si no, pasa a la fase 6–12 m.
- **Hecho cuando:** 30+ comercios activos en 2 barrios, sin incidentes de severidad 1 durante 2 semanas.

```
Semana:  1    3    5    7    9   11   13   15   17   19   21   23   25   27
PoC      ████████
M0               ████
M1                    ████████
M2                              ██████████
M3                                   ██████████
M4                                        ██████████
M5                                                  ████████████
Demo PoC a hosteleros ▲ (sem. 5–6)
Piloto 3–5 locales             ▲ (sem. 11–12)
Piloto 30–50 locales                                           ▲ (sem. 24–28)
(M1 y M2 pueden acortarse porque parten de la PoC; el calendario es conservador)
```

## 4. Criterios para cerrar o pivotar (revisión en el mes 6)

Si con **30+ locales** activos se cumple **cualquiera** de estos criterios, **no se levanta la seed**: se pivota o se para.
- Penetración media en el local < 10 % (porcentaje de mesas pagadas por QR).
- Churn de comercios > 5 % mensual.
- Más del 50 % de los comercios no pagan tras el periodo gratuito.

Opciones de pivote registradas:
- Software de fidelización y CRM puro, sin pagos.
- Vender o licenciar a un fabricante de software de caja.

## 5. Equipo y coste por fase (resumen)

| Fase | Equipo a tiempo completo | Externo | Coste de desarrollo orientativo |
|---|---|---|---|
| Semanas 1–4 (PoC local) | CTO + 0–1 desarrollador fullstack | — | ~0 € si la hacen los fundadores; 10–25 k€ si se paga a un desarrollador sénior autónomo durante 4 semanas [HIPÓTESIS] |
| 0–3 m (MVP muy básico) | CEO + CTO + 1 desarrollador fullstack | UX/UI autónomo, despacho legal y fintech | 55–100 k€ (o mucho menos en efectivo si lo construyen los fundadores) |
| 3–6 m → 6–12 m (MVP profesional) | + 1 backend sénior, + 1 móvil/fullstack, + 1–2 comerciales de campo, + 1 persona de onboarding y soporte | Pentest, diseño | 290–535 k€ en total para el MVP profesional |
| 12–24 m | Producto y diseño 2–3, ingeniería 6–10, pagos y riesgo 1, seguridad 1 | Legal, compliance | — |
| 24–36 m (plataforma escalable) | Ingeniería 10–16 + datos + plataforma | — | 1,8–3,1 M€/año en producto y tecnología |

**Perfiles críticos que no se externalizan:** CTO y núcleo de ingeniería; ventas de campo.
**Perfiles externalizables al inicio:** UX/UI, legal, compliance, pentest, marketing de contenidos.

Desglose completo de costes y financiación en [CONTEXT.md](CONTEXT.md#costes).

## 6. Dependencias críticas y riesgos de calendario

| Dependencia | Bloquea | Mitigación |
|---|---|---|
| Contrato con el PSP y alta como plataforma (D-01) | M1 | Pedir ofertas en la semana 1; empezar con el modo de pruebas del PSP mientras se negocia |
| Acceso a la API del software de caja (D-02) | M2 | Alianza comercial temprana; mantener `ManualPosConnector` como alternativa |
| Opinión legal (flujo de fondos, puntos, GDPR) | Piloto en vivo | Encargarla en la semana 2 |
| Bizum disponible en el PSP elegido | Método de pago | Se lanza solo con tarjeta, Apple Pay y Google Pay si no está |
| Aprobación de plantillas de WhatsApp por Meta | Campañas en M4 | Push y email como alternativa |
| Revisión de la app en las tiendas | App v1 | Lanzamiento con la web QR, que no depende de las tiendas |

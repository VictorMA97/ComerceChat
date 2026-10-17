# SPEC: especificación funcional del MVP de ComerceChat

> **Estado:** borrador v0.2 (17-oct-2026). Añade el alcance de la PoC local ([§3.3](#poc)).
> **Documentos relacionados:**
> - [ARCHITECTURE.md](ARCHITECTURE.md): cómo se construye.
> - [DECISIONS.md](DECISIONS.md): por qué.
> - [ROADMAP.md](ROADMAP.md): cuándo.
> - [CONTEXT.md](CONTEXT.md): negocio, regulación y mercado.
>
> **Fuente detallada:** [ANALISIS_PROYECTO.md](ANALISIS_PROYECTO.md).
>
> **Etiquetas:** [HIPÓTESIS] indica un valor por validar en el piloto; [INCIERTO] indica que depende de un proveedor o de una decisión abierta.

---

## 1. Visión del producto (MVP)

ComerceChat es una plataforma de **"pedir, pagar y volver"** para restaurantes con servicio en mesa:
- **El comensal** escanea el QR de la mesa y, **sin instalar nada**, ve la cuenta y la carta, pide, divide la cuenta, paga (tarjeta, Apple Pay, Google Pay, Bizum) y deja propina. Al terminar, se le invita a guardar sus puntos.
- **El restaurante** obtiene un cobro más rápido, más propinas, una base de clientes propia con consentimiento, y herramientas sencillas de fidelización y campañas.

**Mercado inicial:** restaurantes independientes y grupos pequeños (1–5 locales) con ticket medio de 25–60 €, en 2 barrios de Madrid.

**Fuera de la visión del MVP:** la "superapp" (monedero, envíos entre usuarios, delivery, mini-apps). Ver [DECISIONS.md › ADR-001](DECISIONS.md#adr-001).

## 2. Actores

| Actor | Descripción | Canal |
|---|---|---|
| **Comensal invitado** | Paga sin cuenta | Web QR (navegador) |
| **Usuario registrado** | Comensal con cuenta (teléfono verificado) | Web QR, app móvil, tarjeta en Apple/Google Wallet |
| **Dueño (OWNER)** | Responsable legal del comercio; alta del comercio ante el PSP; configuración, reembolsos, roles | Panel comercio |
| **Encargado (MANAGER)** | Gestión diaria: mesas, carta, promociones, informes | Panel comercio |
| **Camarero (STAFF)** | Ve el estado de las mesas y genera QR dinámicos de mostrador | Panel comercio (vista móvil o tablet) |
| **Admin ComerceChat** | Soporte, riesgo, alta de comercios, auditoría | Backoffice interno |
| **PSP** (sistema externo) | Procesa pagos, verifica comercios (KYB), liquida y gestiona disputas | API + webhooks |
| **Software de caja (TPV del restaurante)** (sistema externo) | Fuente de verdad de la cuenta de la mesa y de los tickets o facturas | API |

## 3. Alcance

### 3.1 Incluido en el MVP

**Web QR (comensal):**
- Escaneo de QR de mesa, con el comercio verificado visible (nombre, foto, dirección, mesa).
- Ver la cuenta en tiempo real (desde el software de caja) y la carta.
- Pedido desde la mesa (envío a cocina o barra vía software de caja).
- Dividir la cuenta: a partes iguales, por artículos o por importe libre.
- Propina: 0, 5, 10 % u otra cantidad.
- Pago con tarjeta, Apple Pay, Google Pay y Bizum [INCIERTO: según el PSP].
- Justificante de pago por email o descarga. **No es factura**: la factura la emite el software de caja.
- Registro posterior al pago para "guardar puntos", y tarjeta de fidelización en Apple/Google Wallet.
- Valoración rápida 1–5 (privada; si es 5, se invita a dejar reseña en Google).
- Idiomas ES y EN.

**App de usuario (nativa, mínima; meses 4–6):**
- Cartera de puntos por comercio.
- Cupones activos.
- Historial de pagos hechos con ComerceChat.
- Lista o mapa de **comercios de la red** ("Tus sitios" + "Cerca").
- Notificaciones push.

**Panel del comercio (web):**
- Alta del comercio con verificación KYB en el flujo alojado por el PSP.
- Locales, mesas y generación e impresión de QR.
- QR dinámico de mostrador por importe.
- Configuración de propinas y del programa de fidelización (puntos por euro o sellos).
- Promociones y cupones mediante plantillas.
- Panel de ventas vía ComerceChat, propinas, ticket medio, clientes y repetición.
- CRM básico: clientes que han dado su consentimiento.
- Exportación CSV.
- Roles OWNER, MANAGER y STAFF.
- Reembolsos (solo OWNER).

**Integraciones:**
- 1 PSP de plataforma [INCIERTO: ver [DECISIONS.md › D-01](DECISIONS.md#d-01)].
- 1–2 softwares de caja de hostelería [INCIERTO: D-02].
- Push (FCM/APNs), email transaccional, SMS/WhatsApp para códigos de un solo uso (OTP).
- WhatsApp para campañas, opcional en el MVP y de pago por mensaje [INCIERTO: D-04].

### 3.2 Excluido del MVP (explícitamente)

| Excluido | Motivo | Ver |
|---|---|---|
| Monedero, saldo, recargas, envíos entre usuarios, cashback en dinero | Requiere licencia de dinero electrónico o entidad de pago | ADR-004 |
| Delivery | Unidad económica negativa; fuera del foco | ADR-001 |
| Reservas | Solo enlace externo a la herramienta del comercio | ADR-001 |
| Mapa de "todos los comercios" | Solo comercios de la red | ADR-001 |
| Comercio destacado / publicidad | Requiere densidad de usuarios | ROADMAP fase 12–24 m |
| Mini-apps / API pública | Requiere red | ROADMAP fase 24–36 m |
| Puntos de coalición entre comercios | Revisión legal de "red limitada" pendiente | ADR-005 |
| Emisión de tickets o facturas | VeriFactu | ADR-006 |
| Chino y otros idiomas | Fase 2 si se valida el turismo | ADR-014 |
| Alipay+ / WeChat Pay | Fase 2, solo vía PSP | ADR-014 |
| Tap to Pay (NFC en el móvil del camarero) | Fase 2 | ROADMAP |
| Chat comercio–usuario | Fuera de foco | — |
| Funciones de IA no justificadas | Fuera de foco | — |

<a id="poc"></a>
### 3.3 PoC local (antes del MVP)

La **prueba de concepto (PoC) local** es una versión del MVP que funciona entera en un portátil, con los proveedores externos simulados (ver [DECISIONS.md › ADR-017/018](DECISIONS.md#adr-017)).

**Objetivo:** demostrar el recorrido completo "escanear → ver cuenta → dividir → propina → pagar → puntos → cupón → el comercio lo ve en su panel" a hosteleros e inversores. Además, validar técnicamente las partes de mayor riesgo:
- concurrencia al dividir la cuenta;
- idempotencia de los webhooks;
- canje atómico de cupones;
- tiempo real.

**Duración objetivo:** 3–4 semanas con 1–2 desarrolladores ([ROADMAP.md › PoC](ROADMAP.md#poc)).

**Requisitos incluidos en la PoC** (el resto del MVP queda fuera):

| Área | Incluido | Simplificación en la PoC |
|---|---|---|
| QR | FR-QR-01, FR-QR-03, FR-QR-04, FR-QR-06 | El PDF de placas puede ser una página imprimible en HTML. La URL apunta a la IP local o a un túnel |
| Cuenta y pedidos | FR-ORD-01, FR-ORD-02, FR-ORD-05 | La cuenta viene del **simulador de caja** (`FakePosConnector`). No hay pedido desde la mesa (FR-ORD-03/04 fuera) |
| Pagos | FR-PAY-01, FR-PAY-02, FR-PAY-03, FR-PAY-05, FR-PAY-06, FR-PAY-10 | **PSP simulado** con página de pago falsa que permite pagar, rechazar o "pedir 3DS" y que envía un webhook firmado a la API. Opcional: Stripe en modo de pruebas. Sin Bizum ni Apple/Google Pay reales |
| Usuarios | FR-USR-01, FR-USR-02, FR-USR-04 | OTP mostrado en la consola o en Mailpit; no se envían SMS. Sin passkeys ni Apple/Google |
| Fidelización | FR-LOY-01, FR-LOY-02, FR-LOY-03 | `hold_hours = 0` configurable para que los puntos aparezcan al momento en la demo |
| Cupones | FR-CPN-04, FR-CPN-05, FR-CPN-06 + una plantilla ("Vuelve y te invitamos") | Sin vista previa de alcance ni informes |
| Comercio | FR-MER-04, FR-MER-06, FR-MER-08 | Comercios y usuarios del comercio creados con el script de datos de prueba; inicio de sesión con email y contraseña sin doble factor; sin KYB |
| Analítica | FR-ANA-01 (volumen, nº de pagos, ticket medio, propinas, clientes identificados) | Consultas directas a la base de datos, sin vistas materializadas |
| Tiempo real | Actualización de la mesa vía SSE | — |

**Fuera de la PoC:**
- app nativa, Wallet, WhatsApp, campañas, CRM completo y exportación CSV;
- reembolsos y disputas reales, conciliación;
- KYB real, integración con un software de caja real;
- backoffice, PostHog, infraestructura en la nube;
- pentest y auditoría de accesibilidad (aunque se aplican buenas prácticas).

**Criterios de éxito de la PoC:**
1. Un comensal paga su parte desde su propio móvil en < 30 s desde el escaneo.
2. 4 móviles pagan la misma mesa en paralelo sin pagar dos veces ninguna parte.
3. Reenviar 10 veces el mismo webhook produce 1 solo pago y 1 sola entrada de puntos.
4. 100 peticiones paralelas sobre el mismo cupón producen exactamente 1 canje.
5. El panel del camarero ve "Mesa pagada" en < 3 s.
6. Al menos 5 hosteleros ven la demo y se recoge su feedback.

## 4. Restricciones regulatorias convertidas en requisitos

> En la PoC no se mueve dinero real. Aun así, el código debe respetar estas reglas desde el principio para que el MVP herede un diseño conforme.

Estas reglas son **requisitos del sistema**; romperlas cambia el estatus regulatorio de la empresa. Ver [CONTEXT.md › Regulación](CONTEXT.md#regulacion).

| ID | Requisito |
|---|---|
| **REG-01** | Los fondos de los pagos **nunca** pasan por cuentas de ComerceChat. El cobro va a la cuenta del comercio en el PSP; ComerceChat solo recibe su comisión de plataforma, descontada por el PSP. |
| **REG-02** | No existe saldo monetario de usuario ni transferencias entre usuarios. |
| **REG-03** | Los puntos **no se compran ni se canjean por dinero**. Solo se canjean por descuentos o productos del comercio emisor. |
| **REG-04** | Los cupones los crea y financia el comercio. |
| **REG-05** | El sistema no emite tickets ni facturas (no es un sistema de facturación sujeto a VeriFactu). El justificante de pago debe decir "Justificante de pago, no válido como factura". |
| **REG-06** | Los datos de tarjeta nunca tocan servidores de ComerceChat. Solo se usan componentes alojados por el PSP (ámbito PCI SAQ A). |
| **REG-07** | Consentimientos separados, no premarcados y versionados: (a) términos; (b) marketing de ComerceChat; (c) compartir datos con un comercio concreto. Se pueden revocar desde el perfil. |
| **REG-08** | Las comunicaciones comerciales solo se envían a usuarios con el consentimiento correspondiente (LSSI art. 21). |
| **REG-09** | Las promociones con "rebaja" muestran condiciones, vigencia y caducidad claras (normativa de consumo). |
| **REG-10** | La verificación de comercios (KYB) la realiza el PSP. Un comercio sin verificación aprobada no puede cobrar. |

## 5. Requisitos funcionales

Formato: `ID: descripción`, seguido de los **criterios de aceptación (CA)**.

### 5.1 QR (`FR-QR`)

- **FR-QR-01: QR estático de mesa.** Cada mesa tiene un QR con URL `https://pay.<dominio>/t/{shortCode}`.
  - CA: el `shortCode` no es secuencial ni adivinable (≥ 10 caracteres base62). Lleva asociada una firma validada en el servidor. Un código inválido o revocado muestra una página de error segura sin datos del comercio.
- **FR-QR-02: QR estático de mostrador.** Igual que FR-QR-01, pero sin mesa. El comensal introduce el importe o lo introduce el camarero (ver FR-QR-03).
- **FR-QR-03: QR dinámico por importe.** Un STAFF introduce un importe y se genera un QR de un solo uso.
  - CA: caduca a los 5 min (configurable a 10). Importe firmado; se paga una sola vez; tras el pago o la caducidad muestra "QR no válido".
- **FR-QR-04: identidad visible del comercio.** Antes de cualquier pago, la web muestra el logo, el nombre comercial, la dirección y la mesa, más un aviso que invita a comprobar el dominio.
  - CA: visible sin hacer scroll en un móvil de 360 px.
- **FR-QR-05: revocación y regeneración.** OWNER y MANAGER pueden revocar y regenerar el QR de una mesa.
  - CA: el QR revocado deja de funcionar en < 60 s.
- **FR-QR-06: imprimibles.** El panel genera un PDF de placas QR (formato A6 o pegatina) con un mensaje de beneficio ("Paga sin esperar · divide la cuenta en 10 s").

### 5.2 Cuenta, pedidos y carta (`FR-ORD`)

- **FR-ORD-01: ver la cuenta de la mesa.** Al escanear, se obtiene la cuenta abierta de la mesa desde el software de caja.
  - CA: líneas, cantidades, importes, total, ya pagado y pendiente. Actualización en tiempo real (< 3 s) cuando otro comensal paga.
  - Sin cuenta abierta: se muestra la carta y la opción de pedir.
- **FR-ORD-02: carta.** Categorías, productos, precio, alérgenos, fotos y modificadores. Se sincroniza desde el software de caja, o se crea a mano si no hay integración.
- **FR-ORD-03: pedido desde la mesa.** El comensal añade productos y modificadores y envía el pedido.
  - CA: el pedido llega al software de caja (cocina o barra) y se confirma al comensal. Si el software de caja no confirma en 10 s, se muestra un error y se avisa al STAFF.
- **FR-ORD-04: estados del pedido.** Recibido → En preparación → Servido, si el software de caja los expone. Si no, solo "Recibido".
- **FR-ORD-05: modo sin integración** (respaldo). El STAFF introduce el importe total de la mesa en el panel y el comensal paga contra ese importe.

### 5.3 Pagos (`FR-PAY`)

- **FR-PAY-01: pagar la cuenta completa.**
- **FR-PAY-02: dividir la cuenta** a partes iguales (N partes), por artículos o por importe libre.
  - CA: dos comensales no pueden pagar el mismo artículo. El pendiente se recalcula en tiempo real. La suma pagada nunca supera el total (más propinas).
- **FR-PAY-03: propina.** Opciones 0 / 5 / 10 % / importe libre; los porcentajes son configurables por el comercio. La propina se calcula sobre la parte que paga cada comensal.
  - CA: se registra por separado (`tip_cents`) y nunca suma puntos.
- **FR-PAY-04: métodos de pago.** Tarjeta, Apple Pay, Google Pay; Bizum [INCIERTO].
  - CA: se usan los componentes alojados del PSP; la autenticación reforzada (SCA/3DS) la gestiona el PSP.
- **FR-PAY-05: confirmación.** El estado "pagado" **solo** se marca al recibir el webhook firmado del PSP; nunca por la redirección del navegador.
  - CA: el comensal ve la confirmación en < 5 s en el p95. El software de caja recibe el pago y marca la mesa como pagada (total o parcial).
- **FR-PAY-06: justificante.** Pantalla de éxito + email opcional + PDF. Incluye el aviso de REG-05.
- **FR-PAY-07: reembolsos.** Solo OWNER, total o parcial, con motivo obligatorio.
  - CA: se ejecuta vía PSP. Revierte los puntos de forma proporcional y queda en el registro de auditoría.
- **FR-PAY-08: disputas.** Al recibir un *chargeback* del PSP: se marca el pago como `DISPUTED`, se revierten los puntos, se avisa al OWNER y se envían pruebas automáticas al PSP (pedido, mesa, hora, justificante).
- **FR-PAY-09: límite para invitados.** Importe máximo por pago QR sin cuenta: 300 € [HIPÓTESIS], configurable por el admin.
- **FR-PAY-10: comisión de plataforma.** Cada pago lleva la comisión de ComerceChat calculada según el plan del comercio y aplicada por el PSP.
  - CA: el comercio ve el desglose (bruto, comisión del PSP si se conoce, comisión de plataforma, neto).
- **FR-PAY-11: descripción en el extracto.** El cargo aparece en el extracto bancario del comensal como `COMERCECHAT*<NOMBRE COMERCIO>` (límite de caracteres según el PSP).

### 5.4 Usuarios y autenticación (`FR-USR`)

- **FR-USR-01: pagar sin cuenta.** El pago nunca exige registro.
- **FR-USR-02: registro tras el pago.** Pantalla "Has ganado X puntos en {comercio}. Guárdalos" → teléfono → código OTP (SMS o WhatsApp) → cuenta creada y puntos asociados.
  - CA: los puntos ganados como invitado se reclaman con una ventana de 24 h vinculada a la sesión de pago.
- **FR-USR-03: inicio de sesión.** OTP por teléfono, passkeys, Sign in with Apple y Sign in with Google.
- **FR-USR-04: consentimientos** según REG-07, gestionables desde el perfil.
- **FR-USR-05: borrado de cuenta y exportación de datos** (derechos GDPR).
  - CA: el borrado anonimiza los datos personales y conserva los registros financieros anonimizados.
- **FR-USR-06: tarjeta en Wallet.** Pase de Apple/Google Wallet por comercio, con el saldo de puntos actualizado.

### 5.5 Fidelización (`FR-LOY`)

- **FR-LOY-01: programa por comercio.** De tipo `POINTS` (X puntos por € sin propina) o `STAMPS` (1 sello por visita con un importe mínimo). Con caducidad configurable.
- **FR-LOY-02: ganar puntos.** Solo al confirmarse el pago por webhook.
  - CA: se calcula `floor(importe_sin_propina × regla)`. El movimiento se crea `PENDING` y pasa a `AVAILABLE` tras el cierre diario o a las X h (configurable, por defecto 24 h).
- **FR-LOY-03: recompensas.** El comercio define un catálogo de recompensas ("postre gratis = 100 puntos"). Al canjearla se genera un cupón de un solo uso.
- **FR-LOY-04: anulación de puntos.** Un reembolso o *chargeback* anula los puntos asociados de forma proporcional. Si ya se habían gastado, el saldo puede quedar negativo y bloquear canjes.
- **FR-LOY-05: ajustes manuales.** Solo OWNER, con motivo obligatorio y registro de auditoría.
- **FR-LOY-06: notificación.** "+N puntos en {comercio}. Te faltan M para {recompensa}".

### 5.6 Cupones y promociones (`FR-CPN`)

- **FR-CPN-01: plantillas de promoción.**
  - "Vuelve y te invitamos" (2.ª visita).
  - "Días flojos -X %" (días y franjas horarias).
  - "Cumpleaños".
  - "Recupera dormidos" (sin visita en N días).
  - "Bienvenida" (primer registro).
- **FR-CPN-02: configuración.**
  - Público: todos / nuevos / habituales / dormidos.
  - Condiciones: importe mínimo, días, horas.
  - Vigencia, límite de canjes y presupuesto opcional.
  - Canal: dentro de la app o push (gratis), WhatsApp (de pago).
- **FR-CPN-03: vista previa y alcance.** Muestra cuántos clientes con consentimiento recibirían la promoción.
- **FR-CPN-04: emisión.** Cupones individuales con código único vinculado al `user_id`.
- **FR-CPN-05: aplicación en el pago.** El sistema detecta los cupones aplicables del usuario identificado. También admite introducir un código.
  - CA: la validación se hace siempre en el servidor (vigente, no canjeado, condiciones cumplidas, comercio correcto).
- **FR-CPN-06: canje atómico.** `ACTIVE → RESERVED` (con bloqueo; caduca en 10 min) → `REDEEMED` al confirmarse el pago, o vuelta a `ACTIVE` si el pago falla o caduca.
  - CA: no es posible canjear el mismo cupón dos veces aunque haya peticiones simultáneas.
- **FR-CPN-07: informe a las 48 h y al final de la promoción.** Envíos, aperturas, canjes, coste del descuento e ingresos atribuidos.

### 5.7 Comercio: alta y configuración (`FR-MER`)

- **FR-MER-01: registro del comercio.** Email, contraseña y doble factor obligatorio para el OWNER.
- **FR-MER-02: alta ante el PSP.** Redirección al flujo alojado de verificación del PSP.
  - CA: el estado KYB se sincroniza por webhook. Sin verificación aprobada no se pueden activar los QR de pago.
- **FR-MER-03: locales** con dirección, coordenadas, horario, categoría, fotos y software de caja asociado.
- **FR-MER-04: mesas** (alta masiva, etiquetas, capacidad).
- **FR-MER-05: usuarios del comercio y roles** (OWNER, MANAGER, STAFF). Invitación por email.
- **FR-MER-06: configuración de propinas** (porcentajes sugeridos, activar o desactivar).
- **FR-MER-07: plan y facturación de ComerceChat** al comercio. La cuota SaaS se factura fuera del flujo de pagos de los comensales [INCIERTO: D-05].
- **FR-MER-08: vista del camarero.** Mapa de mesas con estado (libre / con cuenta / pago parcial / pagada) y propinas del turno.

### 5.8 CRM (`FR-CRM`)

- **FR-CRM-01: lista de clientes.** Solo usuarios con consentimiento `SHARE_WITH_MERCHANT` para ese comercio.
  - Campos: nombre, nº de visitas, gasto total, última visita, puntos, segmento.
- **FR-CRM-02: segmentos automáticos**: nuevos (1 visita), habituales (≥ 3 en 60 días), dormidos (sin visita en ≥ 45 días).
- **FR-CRM-03: ficha del cliente** con el historial de visitas en ese comercio. Nunca muestra datos de otros comercios.
- **FR-CRM-04: exportación CSV** solo de los clientes con consentimiento. La exportación queda registrada en auditoría.
- **FR-CRM-05: alertas** del tipo "Tienes N clientes dormidos. ¿Lanzar campaña?".

### 5.9 Notificaciones (`FR-NOT`)

- **FR-NOT-01: push al usuario** (puntos, cupón nuevo, cupón a punto de caducar), con preferencias por tipo.
- **FR-NOT-02: email transaccional** (justificante, bienvenida, seguridad).
- **FR-NOT-03: OTP por SMS o WhatsApp.**
- **FR-NOT-04: campañas por WhatsApp** con plantillas aprobadas. El coste por mensaje se muestra antes de enviar.
- **FR-NOT-05: avisos al comercio** (nueva disputa, alta en el PSP completada, informe semanal).

### 5.10 Analítica para el comercio (`FR-ANA`)

- **FR-ANA-01: panel de inicio** con filtro hoy / semana / mes y comparativa con el periodo anterior:
  - volumen vía ComerceChat;
  - nº de pagos;
  - ticket medio;
  - propinas (total y % medio);
  - tiempo medio de pago;
  - % de mesas pagadas por QR;
  - clientes identificados (nuevos y recurrentes);
  - repetición a 30 y 60 días.
- **FR-ANA-02: informe de pagos y conciliación diaria**: bruto, comisiones, neto, reembolsos, disputas.
- **FR-ANA-03: informe de promociones** (ver FR-CPN-07).
- **FR-ANA-04: informe de propinas por día y turno**, exportable.

### 5.11 Integración con software de caja (`FR-POS`)

- **FR-POS-01:** leer la cuenta abierta de una mesa.
- **FR-POS-02:** leer la carta (productos, precios, modificadores, alérgenos).
- **FR-POS-03:** enviar un pedido a una mesa.
- **FR-POS-04:** registrar un pago (total o parcial, con propina) contra la cuenta.
- **FR-POS-05:** emparejar las mesas del software de caja con las mesas de ComerceChat.
- **FR-POS-06: degradación.** Si el software de caja no responde, se activa el modo FR-ORD-05 y se avisa al STAFF.

### 5.12 Valoraciones (`FR-REV`)

- **FR-REV-01:** tras pagar, valoración 1–5 + comentario opcional. Solo valoran quienes han pagado (una valoración por pago).
- **FR-REV-02:** las valoraciones son privadas para el comercio. Con un 5, se ofrece un enlace a la reseña de Google del local.

### 5.13 App de usuario (`FR-APP`)

- **FR-APP-01:** "Tus sitios": comercios con cuenta de fidelización, saldo y recompensa más cercana.
- **FR-APP-02:** "Cerca": comercios de la red por distancia, con filtros "tengo cupón" y "abierto ahora". El botón "Cómo llegar" abre Google o Apple Maps.
- **FR-APP-03:** cupones activos con su caducidad.
- **FR-APP-04:** historial de pagos.
- **FR-APP-05:** perfil, consentimientos y preferencias de notificación.

### 5.14 Backoffice interno (`FR-ADM`)

- **FR-ADM-01:** búsqueda de comercios, usuarios y pagos (con acceso registrado en auditoría).
- **FR-ADM-02:** suspender un comercio o usuario.
- **FR-ADM-03:** cola de revisión de riesgo (eventos `REVIEW`).
- **FR-ADM-04:** ajustar límites (importe máximo para invitados, límites de peticiones).
- **FR-ADM-05:** visor del registro de auditoría.

## 6. Recorridos de usuario

### A. Registro de usuario
1. Paga como invitado (C).
2. En la pantalla de éxito: "Has ganado {N} puntos en {comercio}. Guárdalos" → introduce el móvil.
3. Recibe el OTP (SMS o WhatsApp) y lo introduce.
   - **Errores:** OTP incorrecto (3 intentos y bloqueo de 15 min); número VoIP o desechable (se rechaza); número ya registrado (inicio de sesión y fusión de puntos).
4. Consentimientos (REG-07), nombre y fecha de nacimiento opcionales.
5. Puntos asociados (`PENDING`).
6. Se ofrece la tarjeta en Wallet o la app.

### B. Encontrar un comercio
1. App → "Tus sitios" (por defecto) o "Cerca".
2. Lista o mapa con puntos y ofertas.
3. Ficha del comercio → "Cómo llegar".
   - **Error:** sin permiso de ubicación → se ordena por "Tus sitios" y se ofrece buscar por barrio.

### C. Pago con QR
1. Escaneo → `GET /t/{shortCode}`.
   - **Errores:** QR inválido o revocado (página segura); comercio suspendido ("Este comercio no acepta pagos por QR ahora").
2. Cabecera de identidad (FR-QR-04) + cuenta (FR-ORD-01).
   - **Error:** software de caja caído → modo FR-ORD-05.
3. Elegir: todo / dividir (FR-PAY-02).
4. Cupón aplicable, si el usuario está identificado (FR-CPN-05).
5. Propina (FR-PAY-03).
6. Pagar con el componente del PSP; 3DS si aplica.
   - **Errores:** rechazo (se muestra el motivo genérico y se permite reintentar con otro método); sesión de pago caducada a los 15 min (se libera la parte y el cupón).
7. Webhook → `Payment.CAPTURED` → registro en el software de caja → actualización en tiempo real para el resto de la mesa.
8. Éxito: justificante, puntos, valoración y registro.

### D. Pedido en mesa
1. Escaneo → "Ver carta y pedir".
2. Carrito con modificadores → "Enviar pedido".
3. Confirmación del software de caja → estado "Recibido".
   - **Error:** sin confirmación en 10 s → mensaje + aviso al STAFF.
4. Opción "Pagar ahora" (barra o terraza) o al final (C).

### E. Ganar puntos
1. `payment.succeeded` → motor de fidelización.
2. `EARN` con estado `PENDING`.
3. A las 24 h o al cierre, sin reembolso ni disputa → `AVAILABLE`.
4. Push al usuario.

### F. Usar un cupón
1. En el paso 4 de C, el servidor lista los cupones aplicables.
2. Selección → `RESERVED` (bloqueo de 10 min) → descuento aplicado al importe.
3. Pago correcto → `REDEEMED` + `CouponRedemption`. Pago fallido o caducado → `ACTIVE`.
   - **Error:** cupón ya canjeado o caducado → "Este cupón ya no es válido".

### G. El comercio crea una promoción
1. Panel → Promociones → Nueva → plantilla.
2. Público, condiciones, vigencia, límite y canal.
3. Vista previa con alcance y coste (si es WhatsApp).
4. Publicar → generación asíncrona de los cupones → envío.
5. Informe a las 48 h.

### H. El comercio cobra
1. **Mesa:** el comensal paga solo; el STAFF ve "Mesa 7 pagada · propina 4,20 €".
2. **Mostrador:** el STAFF introduce el importe → QR dinámico (FR-QR-03) → el comensal paga.
3. El PSP liquida al IBAN del comercio (plazo según PSP).
4. Panel → Pagos: desglose y conciliación.

### I. El comercio analiza sus ventas
1. Panel de inicio (FR-ANA-01) → detalle de pagos, propinas, clientes y promociones → exportación CSV.

## 7. Máquinas de estado

```
QRCode:      ACTIVE ──revoke──► REVOKED
             (DYNAMIC) ACTIVE ──paid──► CONSUMED ; ACTIVE ──ttl──► EXPIRED

Merchant:    ONBOARDING ──psp_kyb_approved──► ACTIVE ──admin──► SUSPENDED ──admin──► ACTIVE
             ONBOARDING ──psp_kyb_rejected──► REJECTED

Order:       OPEN ──send──► SENT ──pos_ack──► IN_PREPARATION ──► SERVED ──fully_paid──► PAID
             OPEN/SENT ──cancel──► CANCELLED
             (PARTIALLY_PAID es un indicador derivado: Σ pagos capturados < total)

Payment:     CREATED ──psp_authorized──► AUTHORIZED ──captured──► CAPTURED
             CREATED/AUTHORIZED ──fail/expire──► FAILED
             CAPTURED ──refund(parcial)──► PARTIALLY_REFUNDED ──refund(resto)──► REFUNDED
             CAPTURED ──chargeback──► DISPUTED ──won──► CAPTURED | ──lost──► CHARGED_BACK

Coupon:      ACTIVE ──reserve──► RESERVED ──payment_captured──► REDEEMED
             RESERVED ──payment_failed/ttl──► ACTIVE
             ACTIVE ──valid_to──► EXPIRED ; ACTIVE ──merchant──► REVOKED

PointsLedgerEntry (EARN):
             PENDING ──hold_elapsed & sin disputa──► AVAILABLE
             PENDING ──refund/chargeback──► VOID
             (AVAILABLE nunca se modifica; las anulaciones posteriores generan una entrada REVERSE)
```

## 8. Requisitos no funcionales

| ID | Requisito |
|---|---|
| NFR-01 | Web QR: primer contenido útil en < 1,5 s en 4G y paquete JS inicial < 150 KB comprimido |
| NFR-02 | Disponibilidad de la API de pago ≥ 99,9 % mensual en horario de hostelería (12:00–01:00) |
| NFR-03 | Latencia p95 de la API < 300 ms (sin contar llamadas al PSP o al software de caja) |
| NFR-04 | Accesibilidad WCAG 2.1 AA en la web QR, la app y el panel |
| NFR-05 | Idiomas ES y EN; textos externalizados (i18n) desde el día 1 |
| NFR-06 | Datos alojados en la UE (región AWS eu-south-2) |
| NFR-07 | Ámbito PCI DSS SAQ A (REG-06) |
| NFR-08 | Cifrado en tránsito (TLS 1.2+) y en reposo (KMS) |
| NFR-09 | Retención: registros financieros y de auditoría ≥ 6 años [HIPÓTESIS: confirmar con asesoría]; datos de marketing hasta la revocación del consentimiento |
| NFR-10 | Pentest externo antes del lanzamiento del piloto; revisión de la app móvil según OWASP MASVS L1 |
| NFR-11 | Idempotencia en todos los endpoints de creación de pagos, canjes y webhooks |
| NFR-12 | Funciona en Safari iOS ≥ 16 y Chrome Android ≥ 110, sin necesidad de instalar nada |
| NFR-13 | Observabilidad: trazas de extremo a extremo de cada pago (escaneo → webhook → software de caja) |

## 9. Métricas que el sistema debe poder calcular

Todas se calculan a partir de eventos de producto y de la base de datos. Definiciones en [CONTEXT.md › KPIs](CONTEXT.md#kpis).

- Comercios activos (≥ 50 pagos en 30 días).
- Usuarios activos al mes (MAU).
- Volumen bruto y volumen procesado.
- Nº de pagos.
- Penetración en el local (% de mesas pagadas por QR).
- Retención de comercios a M+3.
- Retención de usuarios a M1 y M3.
- Frecuencia.
- Repetición en el comercio a 30 y 60 días.
- Conversiones: escaneo → pago, pago → registro.
- Comisión neta de pagos (*take rate*).
- Tasa de disputas y fraude.

**Eventos de producto mínimos:**
- `qr_scanned`
- `bill_viewed`
- `split_selected`
- `tip_selected`
- `coupon_applied`
- `payment_started`
- `payment_succeeded`
- `payment_failed`
- `signup_started`
- `signup_completed`
- `points_earned`
- `reward_redeemed`
- `review_submitted`
- `merchant_promo_published`

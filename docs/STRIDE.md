# STRIDE: modelo de amenazas del flujo de pago

> Hito M0 ([ROADMAP §3](ROADMAP.md#m0)). Analiza el flujo de pago **tal como está implementado** (PoC + M0): cada mitigación cita el código o el test que la demuestra. Se revisa en cada hito que toque el flujo y antes del pentest de M5.
>
> Etiquetas: `[HECHO]` mitigación implementada y cubierta por tests; `[PARCIAL]` implementada sin cubrir todos los casos; `[PENDIENTE]` con su hito.

## 1. Alcance

Del escaneo del QR al cobro registrado en la caja:

1. El comensal escanea el QR y la web QR resuelve la mesa y lee la cuenta del software de caja.
2. Elige la parte que paga (entera, partes iguales, platos o importe), propina y cupón, y se crea una sesión de pago.
3. Paga en la página alojada del PSP.
4. El PSP envía un webhook firmado; el worker marca el pago `CAPTURED`.
5. Por el outbox, el pago se registra en la caja, se acreditan puntos y se avisa en tiempo real a la mesa y a la sala.

Fuera de alcance: el alta del comercio y el panel (cubiertos por [ADR-025](DECISIONS.md#adr-025) y [ADR-028](DECISIONS.md#adr-028)), la infraestructura en la nube (pendiente de [D-07](DECISIONS.md#d-07); antes «AWS con Terraform en M0», sustituido por [ADR-030](DECISIONS.md#adr-030)) y el adaptador real del PSP (D-01, M1). Los cambios que trae la migración a microservicios están en [§6](#migracion).

## 2. Activos

| Activo | Por qué importa |
|---|---|
| Dinero del comensal y del comercio | Cobrar dos veces, cobrar de menos o marcar como pagado sin cobrar |
| Estado de la cuenta de la mesa | Pagar la parte de otro o dejar la mesa «pagada» sin estarlo |
| Datos de tarjeta | Fuera de nuestro alcance por diseño (PCI SAQ A) |
| Token de estado del pago | Da acceso al justificante y a reclamar los puntos |
| Cupones y puntos | Valor económico para el comercio |
| Sesiones del panel | Regenerar QR, crear QR de cobro |

## 3. Fronteras de confianza

```
 Navegador del comensal ──(1)──▶ web QR (Next, servidor) ──(2)──▶ API ──▶ Postgres / Redis
        │                                                         ▲   │
        └──────(3)──▶ página alojada del PSP ──(4) webhook firmado─┘   └──(5)──▶ software de caja
```

1. **Internet → web QR.** Entrada no confiable: código del QR, formularios, cookies.
2. **web QR → API.** Red interna. La IP real del cliente solo se acepta con `INTERNAL_PROXY_SECRET`.
3. **Navegador → PSP.** Fuera de nuestro sistema; la redirección de vuelta **no** es prueba de pago.
4. **PSP → API.** Internet; se autentica solo por la firma del cuerpo.
5. **API → caja.** Sistema de terceros, puede fallar o caerse.

## 4. Amenazas y mitigaciones

### S: suplantación

| Amenaza | Mitigación | Estado |
|---|---|---|
| QR falso pegado sobre el real (otra web, phishing) | La web QR muestra comercio y mesa verificados y avisa de comprobar el dominio (FR-QR-04). El QR estático va firmado con HMAC y se comprueba en cada resolución (`qr-signature.ts`) | `[PARCIAL]`: un QR que apunte a otro dominio no se puede impedir desde el sistema; formación del personal y placas a prueba de manipulación en el piloto |
| Webhook falsificado que marca un pago como cobrado | Firma HMAC sobre el cuerpo en bruto con marca de tiempo (±300 s) (`fake-psp-signature.ts`); proveedor desconocido → 404 | `[HECHO]` (`payments.e2e-spec`, `security.e2e-spec`) |
| Volver del PSP con una URL de éxito sin haber pagado | `CAPTURED` solo por webhook ([ADR-015](DECISIONS.md#adr-015)); la página de vuelta solo consulta el estado | `[HECHO]` |
| Ver el justificante o reclamar puntos de otro | Token de estado HMAC por pago (`PAYMENT_STATUS_SECRET`, clave propia) y reclamación en 24 h | `[HECHO]` |
| Suplantar la IP del cliente para esquivar los límites | La cabecera de IP solo se acepta con el secreto compartido de las apps Next (`client-ip.ts`) | `[HECHO]` (`security.e2e-spec`) |
| QR de cobro de la caja reutilizado o falsificado | JWS EdDSA con importe, mesa, caducidad y nonce; de un solo uso (`CONSUMED` al capturarse) ([ADR-023](DECISIONS.md#adr-023)) | `[HECHO]` (`split-realtime.e2e-spec`) |

### T: manipulación

| Amenaza | Mitigación | Estado |
|---|---|---|
| Cambiar el importe en el navegador | El importe lo calcula la API desde la cuenta de la caja y las asignaciones; el navegador solo envía modo de reparto, platos y propina | `[HECHO]` |
| El PSP cobra un importe distinto del pedido (fallo del adaptador) | El webhook se rechaza y se reintenta si `amount ≠ importe − descuento + propina` | `[HECHO]` (`security.e2e-spec`) |
| Varios comensales pagan la misma parte a la vez | `order_allocations` con el pedido bloqueado (`FOR UPDATE`) y el cálculo de lo disponible en la misma transacción ([ADR-022](DECISIONS.md#adr-022)) | `[HECHO]` (criterio 2: 4 pagadores simultáneos) |
| Canjear el mismo cupón dos veces | Reserva atómica (`UPDATE … WHERE status … RETURNING`) y `UNIQUE(coupon_redemptions.coupon_id)` | `[HECHO]` (criterio 4: 100 canjes paralelos) |
| Campos extra en el cuerpo (asignación masiva) | `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`, también en objetos anidados | `[HECHO]` (`security.e2e-spec`) |
| Modificar el registro de auditoría o los consentimientos | Triggers que rechazan `UPDATE` y `DELETE` ([ADR-028](DECISIONS.md#adr-028)) | `[HECHO]` (`merchant-onboarding.e2e-spec`) |

### R: repudio

| Amenaza | Mitigación | Estado |
|---|---|---|
| El comercio niega haber regenerado un QR o creado un QR de cobro | Auditoría con actor, IP y comercio, de solo inserción; visible para el OWNER | `[HECHO]` |
| Disputa sobre un cobro | `transactions` con la referencia del PSP; el PSP es la fuente de verdad del dinero; conciliación diaria | `[PENDIENTE]` M1 (conciliación con el PSP real) |
| Cobros anómalos sin rastro (capturado tras cancelar, descuento sin cupón) | Se cobran (manda el PSP) pero quedan en auditoría y en el log de error | `[HECHO]` |

### I: divulgación de información

| Amenaza | Mitigación | Estado |
|---|---|---|
| Datos de tarjeta en nuestros sistemas | Solo la página alojada del PSP (SAQ A); guardamos marca y últimos 4 dígitos | `[HECHO]` por diseño |
| Ver la cuenta de una mesa sin estar en ella | La cuenta se ve con el código del QR, que está físicamente en la mesa. No hay datos personales en la cuenta | Riesgo aceptado |
| El flujo de eventos de la mesa revela actividad | El SSE solo emite «la mesa ha cambiado», sin importes ni personas | Riesgo aceptado |
| Tokens o datos personales en trazas y logs | Las trazas redactan la query de las URL, Postgres sin parámetros y Redis solo con el comando ([ADR-027](DECISIONS.md#adr-027)); `safeErrorForLog` en los logs; teléfonos y emails cifrados o con hash | `[HECHO]` (`telemetry.spec`) |
| Errores internos al cliente | `ProblemFilter` devuelve RFC 9457 sin trazas internas | `[HECHO]` |
| Enumerar QR | Códigos aleatorios en base62 (no secuenciales) y límite general por IP | `[HECHO]` |

### D: denegación de servicio

| Amenaza | Mitigación | Estado |
|---|---|---|
| Ráfagas contra endpoints de pago y login | Límites por IP en Redis, compartidos entre procesos (`throttling.ts`) | `[HECHO]` |
| Reservar partes de la cuenta sin pagar (bloquear la mesa) | Las asignaciones caducan con la sesión de pago y un mismo dispositivo sustituye su intento anterior | `[HECHO]` |
| La caja se cae | Error claro en la web QR (FR-POS-06); el registro en la caja se reintenta sin revertir el pago | `[HECHO]` |
| Webhooks duplicados o en tromba | Deduplicación por `psp_event_id`, respuesta 200 inmediata y proceso en el worker | `[HECHO]` (criterio 3) |
| Cola caída o mensajes envenenados | Reintentos con espera creciente y DLQ tras agotar intentos ([ADR-026](DECISIONS.md#adr-026)) | `[HECHO]` (`queue-sqs.e2e-spec`) |
| Volumen de ataque a nivel de red | WAF y límites en el balanceador | `[PENDIENTE]` [D-07](DECISIONS.md#d-07) (antes M0 con Terraform) |

### E: elevación de privilegios

| Amenaza | Mitigación | Estado |
|---|---|---|
| Un STAFF regenera QR o crea promociones | Roles comprobados en cada petición con el rol **actual** de la base de datos | `[HECHO]` (`merchant-qr.e2e-spec`, `security.e2e-spec`) |
| Sesión robada del OWNER | Doble factor obligatorio para OWNER y MANAGER; sesiones revocables; cookie httpOnly | `[HECHO]` ([ADR-025](DECISIONS.md#adr-025)) |
| Token del comensal usado en el panel o al revés | Audiencias JWT distintas (`merchant`, `user`, `merchant-mfa`) | `[HECHO]` |
| Acceder a datos de otro comercio | Toda consulta del panel filtra por el comercio de la sesión | `[PARCIAL]`: revisión sistemática en el pentest de M5 |

## 5. Riesgos abiertos

| Riesgo | Plan | Hito |
|---|---|---|
| QR sustituido físicamente por uno de phishing | Placas a prueba de manipulación, aviso del dominio en la web QR, formación del personal | Piloto (M1) |
| Conciliación con el PSP | Conciliación diaria contra los informes del PSP real | M1 |
| WAF y secretos en un gestor de claves | Infraestructura en la nube | [D-07](DECISIONS.md#d-07) (antes M0 con AWS) |
| Recuperación de cuenta sin códigos de recuperación | Reinicio del doble factor por soporte con verificación | M5 (backoffice) |
| Revisión sistemática de autorización entre comercios | Pentest externo | M5 |

<a id="migracion"></a>
## 6. Cambios previstos por la migración a microservicios

[ADR-029](DECISIONS.md#adr-029) y [ADR-030](DECISIONS.md#adr-030); plan en [MIGRACION.md](MIGRACION.md). Esta sección pasa a §3–§4 a medida que cada fase quede implementada y probada.

**Fronteras de confianza nuevas:**

6. **BFF → gateway nginx → servicio.** Sustituye a (2). El gateway solo enruta `/v1`; la IP del cliente sigue aceptándose solo con `INTERNAL_PROXY_SECRET`.
7. **Servicio → servicio (`/internal/*`).** Red interna del clúster; el gateway no expone estas rutas.
8. **Servicio → colas → servicio.** Eventos de dominio entre servicios (outbox y una cola por consumidor).

| Amenaza | Mitigación prevista | Estado |
|---|---|---|
| Llamar a `/internal/*` desde fuera, o saltarse el gateway y llegar directo a un servicio | El gateway no enruta `/internal/*`; secreto compartido `INTERNAL_SERVICE_SECRET` en cada llamada interna; los servicios no se publican fuera del clúster | `[PENDIENTE]` MS F2–F7. Recomendado: `NetworkPolicy` y mTLS (MIGRACION §9) |
| Un servicio comprometido lee o modifica datos de otro | Un rol de Postgres por servicio con permisos solo sobre su esquema | `[PARCIAL]`: esquemas separados y sin claves foráneas entre ellos `[HECHO]` (MS F1.6); roles `[PENDIENTE]` al extraer cada servicio (F3–F6) |
| Evento falso o duplicado en una cola (puntos o cupones de más) | Solo los servicios escriben en las colas; procesadores idempotentes (`psp_event_id`, índice único de `EARN`, id del cupón en `CouponIssued.v1`, id de la entrada en `AuditRecorded.v1`) | `[PARCIAL]`: idempotencia `[HECHO]` (criterio 3); escritura restringida `[PENDIENTE]` |
| Perder entradas de auditoría al separar `audit` | Se escriben en el outbox dentro de la transacción del cambio y se insertan de forma idempotente | `[HECHO]` MS F1.5 (`merchant-onboarding.e2e-spec`, `security.e2e-spec`) |
| Rol o baja del comercio que no se aplican en otros servicios | Todos validan la sesión contra `identity` en cada petición, con los mismos criterios que hoy (rol actual, estado y doble factor) | `[PENDIENTE]` MS F5 |
| Secretos en los manifiestos de Kubernetes | `Secret` generados desde `.env.local`, nunca en el repositorio | `[PENDIENTE]` MS F7. Recomendado: External Secrets o Sealed Secrets |

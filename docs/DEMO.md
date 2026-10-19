# DEMO: recorrido manual de la PoC

> Guía técnica para ejecutar a mano el recorrido completo de la PoC ([SPEC §3.3](SPEC.md#poc)) sobre los datos de prueba de `pnpm db:seed`. La versión automatizada es `pnpm e2e` ([ARCHITECTURE §16.6](ARCHITECTURE.md#poc-local)).

## 1. Preparación

1. Arranca el entorno, o solo `pnpm dev` si los servicios de Docker ya están levantados:
   ```bash
   pnpm poc:up --tunnel
   ```
2. Para partir de datos limpios, ejecuta `pnpm db:seed`. Los códigos de los QR cambian.
3. En el portátil, abre:
   - el panel en http://localhost:3001 (`owner@casapepe.test` / `poc1234`), con la **Sala** en una pestaña y el **Simulador de caja** en otra;
   - Mailpit en http://localhost:8025, para ver los códigos de un solo uso de números que no sean el de demo.
4. Para usar un móvil real, la web QR tiene que ser accesible a través del túnel (`WEB_QR_BASE_URL`). Por el túnel, la web QR se actualiza por sondeo cada ~3 s, porque el túnel rápido de Cloudflare no admite SSE (ADR-022).
5. Número de demo: `+34600000000`, con código `000000`, sin límite de envíos y solo fuera de producción (ADR-024).

## 2. Recorrido

| # | Acción | Resultado esperado | Qué se ejercita |
|---|---|---|---|
| 1 | Panel → **Sala** | Casa Pepe: mesas 1–3 «Con cuenta», resto «Libre» | `GET /merchant/floor`, estado del TPV simulado |
| 2 | Panel → **Mesas y QR** → escanear el QR de la **Mesa 1** | Cabecera con comercio y mesa, y la cuenta leída del TPV | QR firmado (FR-QR-01/04), `GET /qr/:code/bill` |
| 3 | Propina **10 %** → **Pagar** → en el PSP simulado, **Pagar** | Justificante con cuenta, propina y total | Sesión idempotente, webhook firmado, captura (ADR-015) |
| 4 | Mirar la **Sala** sin recargar | Mesa 1 → «Pagada» en < 3 s (por SSE en local) | Outbox → registro en el TPV → tiempo real (criterio 5) |
| 5 | En el justificante: móvil `600 000 000` → código `000000` → aceptar condiciones → **Guardar mis puntos** | «+33 puntos guardados», saldo y cupón «Vuelve y te invitamos» | Código de un solo uso, consentimientos (REG-07), reclamación (FR-USR-02), cupón de bienvenida |
| 6 | Escanear la **Mesa 2** en dos navegadores: uno paga **Solo mis platos** (el jamón) y el otro **A partes iguales** | Ninguno puede reservar lo que el otro está pagando; la cuenta refleja «Pagando ahora otros comensales» | `order_allocations` con el pedido bloqueado (ADR-022, criterio 2) |
| 7 | Con la sesión del paso 5, pagar con el **cupón de 5 €** | Línea «Cupón −5,00 €», propina sobre lo que paga el comensal, puntos automáticos | Reserva y canje atómico del cupón (FR-CPN-06), puntos por outbox |
| 8 | **Simulador de caja** → **Cobrar con QR** en la Mesa 3 → pagarlo con el móvil | La tarjeta de la mesa pasa a «Cobrado con QR» y la cuenta se cierra | QR dinámico firmado (ADR-023) |
| 9 | **Simulador de caja** → **Simular caída** | La web QR muestra «No podemos consultar la cuenta» | `PosUnavailableError` (FR-POS-06) |
| 10 | Panel → **Analítica** y **Promociones** | Volumen, pagos, propinas, descuentos y clientes identificados; cupones emitidos y canjeados | `GET /merchant/analytics`, `GET /merchant/promotions` |

## 3. Resolución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El QR no abre en el móvil | La URL del túnel ha cambiado o el túnel no ha registrado la conexión | `pnpm poc:tunnel`; si sigue sin resolver, reinicia el contenedor `tunnel` y repite |
| «No hay ninguna cuenta abierta» | La mesa no tiene cuenta en el TPV simulado | Añade platos desde el **Simulador de caja** |
| El número de demo ya existe | Se dio de alta en una prueba anterior | `pnpm db:seed` o usa otro número (código en Mailpit) |
| Puertos 3000/3001/4000 ocupados | Procesos huérfanos de un `pnpm dev` anterior | `pnpm poc:stop` |
| Postgres o Redis rechazan la conexión | Otro servicio ocupa el puerto 5432/6379 y el contenedor arrancó sin publicarlo | Libera el puerto y ejecuta `docker compose up -d --force-recreate postgres redis` |

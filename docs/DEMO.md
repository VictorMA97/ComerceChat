# DEMO: guion de 5 minutos de la PoC

> Para enseñar ComerceChat a hosteleros e inversores (criterio 6 de [SPEC §3.3](SPEC.md#poc)). Se apoya en los datos de prueba de `pnpm db:seed`.

## Antes de empezar (5 min antes)

1. Arranca la PoC (o, si ya hay datos, solo `pnpm dev`):
   ```bash
   pnpm poc:up --tunnel
   ```
2. Si quieres limpiar los datos: `pnpm db:seed` (los QR cambian; vuelve a imprimirlos o enséñalos en pantalla).
3. Abre en el portátil:
   - **Sala:** http://localhost:3001/sala (`owner@casapepe.test` / `poc1234`).
   - **Simulador de caja**, en otra pestaña.
4. Ten a mano un móvil. Por el túnel la web QR va igual que en producción, pero se actualiza cada ~3 s en lugar de al instante (ADR-022).
5. Número de demo para darse de alta: **600 000 000**, código **000000**. Cualquier otro número recibe el código en la consola de la API y en Mailpit (http://localhost:8025).

## Guion

| Min. | Qué haces | Qué cuentas |
|---|---|---|
| 0:00 | Enseña la **Sala**: Casa Pepe con mesas libres y mesas con cuenta | «Esto es lo que ve el camarero. Las mesas 1–3 tienen cuenta abierta en su caja.» |
| 0:30 | Desde **Mesas y QR**, escanea con el móvil el QR de la **Mesa 1** | «El cliente no descarga nada: escanea y ve su cuenta, leída de la caja del restaurante.» |
| 1:00 | Elige **10 %** de propina → **Pagar** → en el PSP simulado, **Pagar** | «Paga en segundos con Apple Pay, Google Pay, Bizum o tarjeta. Aquí el pago es simulado.» |
| 1:30 | Señala la **Sala**: la Mesa 1 pasa a **Pagada** sola | «El camarero no ha hecho nada: la mesa está cobrada y registrada en su caja.» |
| 2:00 | En el móvil: **Guardar mis puntos** con el número de demo, acepta las condiciones y marca compartir datos | «Sin contraseñas. El cliente decide si comparte sus datos con el restaurante (RGPD).» Verás **+33 puntos** y el cupón **«Vuelve y te invitamos»**. |
| 2:45 | Escanea la **Mesa 2**, elige **Solo mis platos** (el jamón) y que otra persona (u otro navegador) pague **A partes iguales** | «Dividir la cuenta es el momento más incómodo de la cena. Aquí cada uno paga lo suyo y nadie puede pagar dos veces lo mismo.» |
| 3:30 | Con tu sesión, aplica el **cupón de 5 €** al pagar | «La próxima visita la paga en parte el restaurante: fidelización sin tarjetas de cartón.» |
| 4:00 | En el **Simulador de caja**, pulsa **Cobrar con QR** en la Mesa 3 y págalo con el móvil | «Si el cliente prefiere que se lo cobre el camarero, el TPV genera un QR por lo que queda.» |
| 4:30 | Panel → **Analítica** y **Promociones** | «Ventas por QR, propinas, ticket medio y clientes identificados. Y cuántos cupones se canjean de verdad.» |
| 5:00 | Cierra | Pregunta: «¿Cuánto tardáis hoy en cobrar una mesa de 6? ¿Usaríais esto mañana?» Anota el feedback. |

## Si algo falla

| Síntoma | Solución |
|---|---|
| El QR no abre en el móvil | El túnel ha cambiado de URL: `pnpm poc:tunnel` (no hace falta reiniciar ni reimprimir). |
| «No hay ninguna cuenta abierta» | Añade platos a la mesa desde el **Simulador de caja**. |
| El número de demo ya existe | `pnpm db:seed` (o usa otro número y lee el código en Mailpit). |
| Puertos ocupados al arrancar | `pnpm poc:stop` y vuelve a arrancar. |

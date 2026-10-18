# ComerceChat

*Pedir, pagar y volver* para restaurantes con servicio en mesa: web QR sin instalación, puntos y cupones del propio comercio y panel con CRM. Esta rama contiene la **PoC local** ([SPEC §3.3](docs/SPEC.md#poc), [ARCHITECTURE §16](docs/ARCHITECTURE.md#poc-local)).

**Estado:** hitos **P1, P2 y P3** de la PoC completados ([ROADMAP §2](docs/ROADMAP.md#poc)): mesas y QR firmados, cuenta leída de una caja simulada, pago con un PSP simulado (webhooks firmados, idempotencia, worker), dividir la cuenta entre varios comensales, cobro con QR desde la caja, vista de sala y tiempo real. Siguiente: usuarios, puntos y cupones (P4).

## Requisitos

- Node 22 (ver `.nvmrc`) y pnpm (se activa con `corepack enable pnpm`; la versión está fijada en `package.json`).
- Docker con `docker compose` (Postgres+PostGIS, Redis y Mailpit). En WSL: activa la integración WSL de Docker Desktop o instala docker-ce.

## Puesta en marcha

```bash
pnpm install
```

```bash
pnpm poc:up
```

`poc:up` levanta Docker, genera `.env.local` con secretos aleatorios (solo la primera vez), aplica migraciones, carga los datos de prueba y arranca todas las apps:

| App | URL | Notas |
|---|---|---|
| Panel del comercio | http://localhost:3001 | `owner@casapepe.test` / `poc1234` (también `staff@casapepe.test`, `owner@tascadeana.test`) |
| Web QR | http://localhost:3000/t/{código} | Escanea un QR del panel |
| API + Swagger | http://localhost:4000/docs | OpenAPI en `/docs/openapi.json` |
| Mailpit | http://localhost:8025 | OTP y emails (a partir de P4) |

### Probar un pago (P2)

1. En el panel, abre **Simulador de caja**: las mesas 1–3 ya tienen cuenta abierta; añade platos a cualquier otra.
2. Vuelve a **Mesas y QR** y abre (o escanea) el QR de una mesa con cuenta: verás la cuenta, eliges propina y pulsas **Pagar**.
3. En la página del **PSP simulado** elige: pagar, pagar con 3DS, o simular una tarjeta rechazada.
4. Llegas al justificante. En el simulador de caja la mesa aparece **Cerrada** con el pago de ComerceChat.
5. Desde el simulador puedes **simular una caída del TPV**: la web QR pedirá avisar al personal.

### Dividir la cuenta y cobrar con QR desde la caja (P3)

1. Abre en el panel la **Sala** (se actualiza sola) y, en dos o más móviles, el QR de una mesa con cuenta.
2. En cada móvil elige **qué pagas**: todo lo pendiente, a partes iguales, solo tus platos u otro importe. Mientras uno paga, los demás ven «Pagando ahora otros comensales» y no pueden pagar lo mismo.
3. **Cobrar con QR desde la caja**: en el **Simulador de caja**, pulsa «Cobrar con QR» en una mesa. Sale un QR por lo que queda por pagar; el cliente lo escanea, paga y la mesa pasa a «Cobrado con QR» al instante. Caduca a los 5 min y solo admite un pago.
4. Si un comensal abandona el pago, en su página de estado puede **liberar su parte**.

Por el túnel (`pnpm poc:tunnel`) el móvil se actualiza cada ~3 s en lugar de al instante: el túnel rápido de Cloudflare no deja pasar SSE ([ADR-022](docs/DECISIONS.md#adr-022)).

### Probar desde el móvil

```bash
pnpm poc:up --tunnel
```

Arranca un túnel HTTPS de Cloudflare (contenedor `tunnel` de `docker-compose.yml`, perfil `tunnel`) y pone su URL `https://xxxx.trycloudflare.com` en `WEB_QR_BASE_URL`. Los QR del panel apuntan entonces a esa URL: escanéalos desde la pantalla con el móvil, en wifi o con datos. Solo se expone la web QR (puerto 3000); la API y el panel siguen siendo locales. **Cualquiera con la URL puede abrir la web QR mientras el túnel esté activo.**

- Con la app ya arrancada: `pnpm poc:tunnel`. No hace falta reiniciar: en desarrollo la API relee `WEB_QR_BASE_URL` de `.env.local` y la web QR acepta cualquier `*.trycloudflare.com`.
- Volver a local: `pnpm poc:tunnel --stop`.
- **La URL cambia si el contenedor del túnel se reinicia** (p. ej. al reiniciar el PC). Si los QR dejan de abrir en el móvil, vuelve a ejecutar `pnpm poc:tunnel`: recoge la URL nueva. No hace falta regenerar los QR.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Arranca API (:4000), web QR (:3000) y panel (:3001) en modo desarrollo |
| `pnpm lint` · `pnpm typecheck` · `pnpm build` | Calidad y build de todo el monorepo (Turborepo) |
| `pnpm test` | Tests de la API (Vitest). Los E2E necesitan Postgres y Redis arrancados |
| `pnpm db:generate` | Genera una migración SQL a partir de cambios en `apps/api/src/db/schema` |
| `pnpm db:migrate` | Aplica las migraciones |
| `pnpm db:seed` | **Borra** y recrea los datos de prueba |
| `pnpm poc:keys [--force]` | Genera `.env.local` desde `.env.example` |
| `pnpm poc:tunnel [--stop]` | Túnel HTTPS para abrir la web QR desde el móvil |

## Estructura

```
apps/api             NestJS 12 (ESM) · Drizzle · Postgres/PostGIS · Redis
apps/web-qr          Next.js 16 · lo que ve el comensal al escanear
apps/merchant-panel  Next.js 16 · panel del comercio
packages/shared-types  enums y contratos de la API compartidos
```

Documentación de diseño en [`docs/`](docs): [SPEC](docs/SPEC.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [DECISIONS](docs/DECISIONS.md) · [ROADMAP](docs/ROADMAP.md) · [CONTEXT](docs/CONTEXT.md).

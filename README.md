# ComerceChat

*Pedir, pagar y volver* para restaurantes con servicio en mesa: web QR sin instalación, puntos y cupones del propio comercio y panel con CRM. Esta rama contiene la **PoC local** ([SPEC §3.3](SPEC.md#poc), [ARCHITECTURE §16](ARCHITECTURE.md#poc-local)).

**Estado:** hito **P1** de la PoC completado ([ROADMAP §2](ROADMAP.md#poc)): monorepo, base de datos, autenticación del panel, mesas y QR firmados. Todavía no hay pagos (P2).

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

**Probar desde el móvil:** pon en `WEB_QR_BASE_URL` (en `.env.local`) una URL accesible desde el móvil y vuelve a ejecutar `pnpm db:seed` para regenerar los QR. En WSL2 la IP de la WSL no es accesible desde la wifi: usa la red en modo *mirrored* de WSL o un túnel HTTPS.

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

## Estructura

```
apps/api             NestJS 12 (ESM) · Drizzle · Postgres/PostGIS · Redis
apps/web-qr          Next.js 16 · lo que ve el comensal al escanear
apps/merchant-panel  Next.js 16 · panel del comercio
packages/shared-types  enums y contratos de la API compartidos
```

Documentación de diseño: [SPEC](SPEC.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DECISIONS](DECISIONS.md) · [ROADMAP](ROADMAP.md) · [CONTEXT](CONTEXT.md).

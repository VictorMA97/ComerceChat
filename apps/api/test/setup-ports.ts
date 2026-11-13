// Se ejecuta antes de cada fichero de tests de integración (vitest setupFiles). Desde MS F3 los
// simuladores son servicios aparte: cada fichero levanta en su proceso la API y los simuladores, y
// la API los llama por HTTP como en `pnpm dev`. Va aquí, y no en un beforeAll, porque la
// configuración de la API se lee (y se cachea) al cargar algunos ficheros de tests.
//
// Puertos fijos por worker de Vitest (VITEST_POOL_ID es distinto en cada fichero que corre a la
// vez): reservar puertos libres y soltarlos dejaba una carrera entre ficheros en paralelo.
const worker = Number(process.env.VITEST_POOL_ID ?? 1);
const base = 24_000 + worker * 10;
const [api, psp, pos] = [base, base + 1, base + 2];

process.env.TEST_API_PORT = String(api);
// Adónde entrega el PSP simulado los webhooks: la API de este fichero de tests.
process.env.API_BASE_URL = `http://localhost:${api}`;
process.env.FAKE_PSP_URL = `http://localhost:${psp}`;
process.env.FAKE_POS_URL = `http://localhost:${pos}`;
// El simulador de caja pide a la API sesiones, locales, mesas y QR de cobro (/v1/internal/*).
process.env.API_INTERNAL_URL = `http://localhost:${api}`;

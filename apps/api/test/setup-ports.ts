// Se ejecuta antes de cada fichero de tests de integración (vitest setupFiles). Desde MS F3 los
// simuladores son servicios aparte: cada fichero levanta en su proceso la API y los simuladores en
// puertos libres, y la API los llama por HTTP como en `pnpm dev`. Va aquí, y no en un beforeAll,
// porque la configuración de la API se lee (y se cachea) al cargar algunos ficheros de tests.
import { createServer } from 'node:net';

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });

const [api, psp] = await Promise.all([freePort(), freePort()]);
process.env.TEST_API_PORT = String(api);
// Adónde entrega el PSP simulado los webhooks: la API de este fichero de tests.
process.env.API_BASE_URL = `http://localhost:${api}`;
process.env.FAKE_PSP_URL = `http://localhost:${psp}`;

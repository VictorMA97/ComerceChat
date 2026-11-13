import type { INestApplication } from '@nestjs/common';
import { createFakePspApp } from '@comercechat/fake-psp';
import request from 'supertest';

/** Puerto reservado para la API de este fichero de tests (setup-ports.ts). */
export const apiPort = () => Number(process.env.TEST_API_PORT);

/** Peticiones directas al PSP simulado (su página de pago, como haría la web QR). */
export const fakePsp = () => request(process.env.FAKE_PSP_URL!);

/**
 * Levanta en este proceso los simuladores, que desde MS F3 son servicios aparte, en los puertos que
 * reservó setup-ports.ts. Llamar en el beforeAll, antes de crear la app de la API.
 */
export async function startSimulators(): Promise<{ close: () => Promise<void> }> {
  const psp: INestApplication = await createFakePspApp({ logger: false });
  await psp.listen(new URL(process.env.FAKE_PSP_URL!).port);
  return { close: () => psp.close() };
}

import type { INestApplication } from '@nestjs/common';
import { createFakePosApp } from '@comercechat/fake-pos';
import { createFakePspApp } from '@comercechat/fake-psp';
import request from 'supertest';

/** Puerto reservado para la API de este fichero de tests (setup-ports.ts). */
export const apiPort = () => Number(process.env.TEST_API_PORT);

/** Peticiones directas al PSP simulado (su página de pago, como haría la web QR). */
export const fakePsp = () => request(process.env.FAKE_PSP_URL!);

/** Peticiones directas al simulador de caja (su pantalla del panel, como haría el panel). */
export const fakePos = () => request(process.env.FAKE_POS_URL!);

/**
 * Levanta en este proceso los simuladores, que desde MS F3 son servicios aparte, en los puertos que
 * reservó setup-ports.ts. Llamar en el beforeAll, antes de crear la app de la API.
 */
export async function startSimulators(): Promise<{ close: () => Promise<void> }> {
  const psp: INestApplication = await createFakePspApp({ logger: false });
  await psp.listen(new URL(process.env.FAKE_PSP_URL!).port);
  const pos: INestApplication = await createFakePosApp({ logger: false });
  await pos.listen(new URL(process.env.FAKE_POS_URL!).port);
  return { close: async () => void (await Promise.all([psp.close(), pos.close()])) };
}

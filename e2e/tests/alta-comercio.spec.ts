import { expect, test } from '@playwright/test';
import { totp } from '../../apps/api/src/auth/totp.js';

const PANEL = 'http://localhost:3001';

test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  // Compila las páginas antes de usarlas (ver recorrido-completo.spec.ts).
  for (const path of ['/registro', '/activar-2fa', '/login', '/', '/actividad'])
    await request
      .get(`${PANEL}${path}`, { timeout: 120_000, maxRedirects: 0 })
      .catch(() => undefined);
});

// M0 «hecho cuando»: un comercio se registra con doble factor y crea un local con mesas.
test('alta de comercio: registro, doble factor, local con mesas y QR que acepta pagos', async ({
  page,
}) => {
  const email = `alta-${Date.now().toString(36)}@e2e.test`;
  await page.goto(`${PANEL}/registro`, { waitUntil: 'networkidle' });
  await page.getByLabel('Nombre comercial').fill('Bar Prueba');
  await page.getByLabel('Razón social').fill('Bar Prueba S.L.');
  await page.getByLabel('NIF/CIF').fill('B87654321');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill('una-clave-larga');
  await page.getByLabel('Repite la contraseña').fill('una-clave-larga');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await page.waitForURL(`${PANEL}/activar-2fa`);
  const secret = (await page.locator('code.secret').textContent())!.trim();
  await page.getByLabel('Código de 6 dígitos').fill(totp(secret));
  await page.getByRole('button', { name: 'Activar' }).click();
  await expect(page.getByText('Doble factor activado')).toBeVisible();
  await expect(page.locator('.recovery-codes li')).toHaveCount(10);
  await page.getByRole('link', { name: /ir al panel/ }).click();

  await page.waitForURL(`${PANEL}/`);
  await expect(page.getByRole('heading', { name: 'Bar Prueba' })).toBeVisible();
  await page.getByLabel('Nombre', { exact: true }).fill('Bar Prueba Lavapiés');
  await page.getByLabel('Dirección').fill('Calle de Argumosa 1, 28012 Madrid');
  await page.getByLabel('Mesas', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Crear local' }).click();
  await expect(page.getByRole('heading', { name: 'Bar Prueba Lavapiés' })).toBeVisible();
  await expect(page.locator('.table-card')).toHaveCount(4);

  // Hasta completar el alta en el PSP, el QR no acepta pagos.
  const qrUrl = (await page.locator('.table-card .qr-url').first().getAttribute('href'))!;
  const before = await page.request.get(qrUrl);
  expect(await before.text()).toContain('no acepta pagos');
  await page.getByRole('button', { name: /Completar alta/ }).click();
  await expect(page.getByRole('button', { name: /Completar alta/ })).toHaveCount(0);

  await page.getByLabel('Añadir').fill('2');
  await page.getByRole('button', { name: 'Añadir', exact: true }).click();
  await expect(page.locator('.table-card')).toHaveCount(6);

  // Mesa 6: nueva y sin consultar antes (la resolución del QR se cachea unos segundos).
  const lastQr = (await page.locator('.table-card .qr-url').last().getAttribute('href'))!;
  const diner = await page.context().newPage();
  await diner.goto(lastQr);
  await expect(diner.getByRole('heading', { name: 'Bar Prueba', level: 1 })).toBeVisible();
  await expect(diner.getByText('Mesa 6')).toBeVisible();
  // El simulador de caja tiene la mesa enlazada, aún sin cuenta abierta.
  await expect(diner.getByText('No hay ninguna cuenta abierta')).toBeVisible();

  // El OWNER ve su registro de actividad (ADR-028).
  await page.getByRole('link', { name: 'Actividad' }).click();
  await expect(page.getByRole('cell', { name: 'Doble factor activado' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Registro del comercio' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Mesas creadas' }).first()).toBeVisible();
  await page.screenshot({ path: 'test-results/actividad.png', fullPage: true });
});

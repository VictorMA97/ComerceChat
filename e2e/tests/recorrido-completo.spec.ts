import { type Browser, expect, type Page, test } from '@playwright/test';

const PANEL = 'http://localhost:3001';
const WEB_QR = 'http://localhost:3000';

/** El global setup fija WEB_QR_BASE_URL a localhost: los QR se abren tal cual (mismo dominio en todo el recorrido). */
const local = (qrUrl: string) => {
  expect(new URL(qrUrl).origin).toBe(WEB_QR);
  return qrUrl;
};

/**
 * En modo desarrollo, Next compila cada página la primera vez que se pide; un envío durante esa
 * compilación se puede perder. Se visitan una vez todas las páginas del recorrido antes de empezar.
 */
test.beforeAll(async ({ request }) => {
  test.setTimeout(240_000);
  const pages = [
    `${PANEL}/login`,
    `${PANEL}/`,
    `${PANEL}/sala`,
    `${PANEL}/analitica`,
    `${PANEL}/promociones`,
    `${PANEL}/pos-simulator`,
    `${WEB_QR}/`,
    `${WEB_QR}/cuenta`,
    `${WEB_QR}/t/calentamiento`,
    `${WEB_QR}/p/00000000-0000-0000-0000-000000000000?t=x`,
    `${WEB_QR}/fake-psp/checkout/x`,
  ];
  for (const url of pages)
    await request.get(url, { timeout: 120_000, maxRedirects: 0 }).catch(() => undefined);
});

async function panel(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(`${PANEL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill('owner@casapepe.test');
  await page.getByLabel('Contraseña').fill('poc1234');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`${PANEL}/`);
  return page;
}

async function tableUrl(page: Page, label: string): Promise<string> {
  await page.goto(`${PANEL}/`, { waitUntil: 'networkidle' });
  const card = page.locator('.table-card', {
    has: page.getByRole('heading', { name: label, exact: true }),
  });
  return local((await card.locator('.qr-url').getAttribute('href'))!);
}

const floorStatus = (page: Page, label: string) =>
  page.locator(`.floor-table[aria-label^="${label}:"]`);

test('recorrido completo: pagar, guardar puntos, volver con cupón y verlo en el panel', async ({
  browser,
}) => {
  const desk = await panel(browser);
  const mesa1 = await tableUrl(desk, 'Mesa 1');
  const mesa2 = await tableUrl(desk, 'Mesa 2');
  await desk.goto(`${PANEL}/sala`, { waitUntil: 'networkidle' });
  await expect(floorStatus(desk, 'Mesa 1')).toHaveAttribute('aria-label', /Con cuenta/);

  const phone = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();

  // 1) Escanear y pagar con propina (criterio 1: < 30 s desde el escaneo).
  const scannedAt = Date.now();
  await phone.goto(mesa1, { waitUntil: 'networkidle' });
  await expect(phone.getByRole('heading', { name: 'Casa Pepe' })).toBeVisible();
  await phone.getByText('10 %', { exact: true }).click();
  await phone.getByRole('button', { name: /^Pagar \d/ }).click();
  await phone.waitForURL(/fake-psp\/checkout/);
  const paidClickAt = Date.now();
  await phone.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(phone.getByRole('heading', { name: '¡Pago completado!' })).toBeVisible({
    timeout: 20_000,
  });
  const scanToPaid = (Date.now() - scannedAt) / 1000;
  test
    .info()
    .annotations.push({
      type: 'criterio 1',
      description: `${scanToPaid.toFixed(1)} s del escaneo al pago`,
    });
  console.log(`Criterio 1: ${scanToPaid.toFixed(1)} s del escaneo al pago (< 30 s)`);
  expect(scanToPaid).toBeLessThan(30);

  // 5) La sala ve la mesa pagada sin recargar (criterio 5: < 3 s).
  await expect(floorStatus(desk, 'Mesa 1')).toHaveAttribute('aria-label', /Pagada/, {
    timeout: 3_000,
  });
  const toPaid = ((Date.now() - paidClickAt) / 1000).toFixed(1);
  test
    .info()
    .annotations.push({ type: 'criterio 5', description: `${toPaid} s hasta «Pagada» en la sala` });
  console.log(`Criterio 5: ${toPaid} s desde pagar hasta «Pagada» en la sala (< 3 s)`);

  // 2) Guardar los puntos con el número de demo: alta con código y consentimientos.
  await expect(phone.getByRole('heading', { name: /Has ganado 33 puntos/ })).toBeVisible();
  await phone.getByLabel('Tu móvil').fill('600 000 000');
  await phone.getByRole('button', { name: 'Recibir código' }).click();
  await phone.getByLabel('Código').fill('000000');
  await phone.getByLabel('Tu nombre (opcional)').fill('Demo');
  await phone.getByLabel(/Acepto las condiciones/).check();
  await phone.getByLabel(/Compartir mis datos con Casa Pepe/).check();
  await phone.getByRole('button', { name: 'Guardar mis 33 puntos' }).click();
  await expect(phone.getByText('+33 puntos guardados')).toBeVisible();
  await expect(phone.getByText(/Vuelve y te invitamos/)).toBeVisible();

  // 3) Volver otro día: pagar la Mesa 2 con el cupón de bienvenida; los puntos llegan solos.
  await phone.goto(mesa2, { waitUntil: 'networkidle' });
  await expect(phone.getByText('Mis puntos y cupones →')).toBeVisible();
  await phone.getByText(/Vuelve y te invitamos/).click();
  await expect(phone.locator('.totals .discount')).toContainText('−5,00');
  await expect(phone.getByRole('button', { name: /^Pagar 60,60/ })).toBeVisible();
  await phone.getByRole('button', { name: /^Pagar 60,60/ }).click();
  await phone.waitForURL(/fake-psp\/checkout/);
  await phone.getByRole('button', { name: 'Pagar', exact: true }).click();
  await expect(phone.getByRole('heading', { name: '¡Pago completado!' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(phone.locator('.receipt')).toContainText('−5,00');
  await expect(phone.getByText('+60 puntos')).toBeVisible({ timeout: 10_000 });

  // 4) En su cuenta: 93 puntos y una recompensa canjeable.
  await phone.goto(`${WEB_QR}/cuenta`, { waitUntil: 'networkidle' });
  // Los puntos del pago identificado llegan por el outbox un instante después: se recarga hasta verlos.
  await expect(async () => {
    await phone.reload({ waitUntil: 'networkidle' });
    await expect(phone.getByText('93 pts')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
  await phone
    .locator('.rewards li', { hasText: 'Postre gratis' })
    .getByRole('button', { name: 'Canjear' })
    .click();
  await expect(phone.getByText(/Cupón de 6,00/)).toBeVisible();

  // 6) El comercio lo ve en la analítica y en su promoción.
  await desk.goto(`${PANEL}/analitica?period=today`);
  const identified = desk.locator('.tile', { hasText: 'Clientes identificados' });
  await expect(identified.locator('.tile-value')).toHaveText('1');
  await expect(
    desk.locator('.tile', { hasText: 'Descuentos con cupón' }).locator('.tile-value'),
  ).toContainText('5,00');
  await desk.goto(`${PANEL}/promociones`);
  // 2 emitidos: el de Lucía (datos de prueba) y el de bienvenida del recorrido, que se ha canjeado.
  await expect(desk.locator('.promo').first()).toContainText('2 cupones emitidos · 1 canjeados');
});

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recorrido-completo.spec.ts >> recorrido completo: pagar, guardar puntos, volver con cupón y verlo en el panel
- Location: tests/recorrido-completo.spec.ts:42:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Mis puntos y cupones →')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Mis puntos y cupones →') with timeout 5000ms
  - waiting for getByText('Mis puntos y cupones →')

```

```yaml
- main:
  - heading "Casa Pepe" [level=1]
  - paragraph: Calle del Espíritu Santo, Malasaña, 28004 Madrid
  - text: Mesa 2
  - paragraph:
    - text: Comprueba que la dirección empieza por
    - strong: localhost:3000
    - text: antes de pagar.
  - paragraph:
    - link "Entrar con mi móvil →":
      - /url: /cuenta
  - region "Cuenta de la mesa":
    - heading "Cuenta de la mesa" [level=2]
    - list:
      - listitem: 2× Copa de vino tinto 7,60 €
      - listitem: 1× Jamón ibérico (ración) 19,00 €
      - listitem: 2× Secreto ibérico 33,00 €
      - listitem: 1× Tarta de queso 6,00 €
    - term: Total
    - definition: 65,60 €
    - term: Queda por pagar
    - definition: 65,60 €
  - group "¿Qué pagas?":
    - text: ¿Qué pagas?
    - radio "Todo lo pendiente 65,60 €" [checked]
    - text: Todo lo pendiente
    - strong: 65,60 €
    - radio "A partes iguales"
    - text: A partes iguales
    - radio "Solo mis platos"
    - text: Solo mis platos
    - radio "Otro importe"
    - text: Otro importe
  - group "¿Dejas propina?":
    - text: ¿Dejas propina?
    - radio "Sin propina" [checked]
    - text: Sin propina
    - radio "5 %"
    - text: 5 %
    - radio "10 %"
    - text: 10 %
    - radio "Otra"
    - text: Otra
  - term: Tu parte
  - definition: 65,60 €
  - term: Total
  - definition: 65,60 €
  - button "Pagar 65,60 €"
  - paragraph: Pago seguro procesado por nuestro proveedor de pagos.
- alert
```

# Test source

```ts
  1   | import { type Browser, expect, type Page, test } from '@playwright/test';
  2   | 
  3   | const PANEL = 'http://localhost:3001';
  4   | const WEB_QR = 'http://localhost:3000';
  5   | 
  6   | /** El QR puede apuntar a un túnel (WEB_QR_BASE_URL): en el test se abre la misma ruta en local. */
  7   | const local = (qrUrl: string) => `${WEB_QR}${new URL(qrUrl).pathname}`;
  8   | 
  9   | /**
  10  |  * En modo desarrollo, Next compila cada página la primera vez que se pide; un envío durante esa
  11  |  * compilación se puede perder. Se visitan una vez todas las páginas del recorrido antes de empezar.
  12  |  */
  13  | test.beforeAll(async ({ request }) => {
  14  |   test.setTimeout(240_000);
  15  |   const pages = [
  16  |     `${PANEL}/login`, `${PANEL}/`, `${PANEL}/sala`, `${PANEL}/analitica`, `${PANEL}/promociones`,
  17  |     `${PANEL}/pos-simulator`, `${WEB_QR}/`, `${WEB_QR}/cuenta`, `${WEB_QR}/t/calentamiento`,
  18  |     `${WEB_QR}/p/00000000-0000-0000-0000-000000000000?t=x`, `${WEB_QR}/fake-psp/checkout/x`,
  19  |   ];
  20  |   for (const url of pages) await request.get(url, { timeout: 120_000, maxRedirects: 0 }).catch(() => undefined);
  21  | });
  22  | 
  23  | async function panel(browser: Browser): Promise<Page> {
  24  |   const page = await browser.newPage();
  25  |   await page.goto(`${PANEL}/login`, { waitUntil: 'networkidle' });
  26  |   await page.getByLabel('Email').fill('owner@casapepe.test');
  27  |   await page.getByLabel('Contraseña').fill('poc1234');
  28  |   await page.getByRole('button', { name: 'Entrar' }).click();
  29  |   await page.waitForURL(`${PANEL}/`);
  30  |   return page;
  31  | }
  32  | 
  33  | async function tableUrl(page: Page, label: string): Promise<string> {
  34  |   await page.goto(`${PANEL}/`, { waitUntil: 'networkidle' });
  35  |   const card = page.locator('.table-card', { has: page.getByRole('heading', { name: label, exact: true }) });
  36  |   return local((await card.locator('.qr-url').getAttribute('href'))!);
  37  | }
  38  | 
  39  | const floorStatus = (page: Page, label: string) =>
  40  |   page.locator(`.floor-table[aria-label^="${label}:"]`);
  41  | 
  42  | test('recorrido completo: pagar, guardar puntos, volver con cupón y verlo en el panel', async ({ browser }) => {
  43  |   const desk = await panel(browser);
  44  |   const mesa1 = await tableUrl(desk, 'Mesa 1');
  45  |   const mesa2 = await tableUrl(desk, 'Mesa 2');
  46  |   await desk.goto(`${PANEL}/sala`, { waitUntil: 'networkidle' });
  47  |   await expect(floorStatus(desk, 'Mesa 1')).toHaveAttribute('aria-label', /Con cuenta/);
  48  | 
  49  |   const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  50  | 
  51  |   // 1) Escanear y pagar con propina (criterio 1: < 30 s desde el escaneo).
  52  |   const scannedAt = Date.now();
  53  |   await phone.goto(mesa1, { waitUntil: 'networkidle' });
  54  |   await expect(phone.getByRole('heading', { name: 'Casa Pepe' })).toBeVisible();
  55  |   await phone.getByText('10 %', { exact: true }).click();
  56  |   await phone.getByRole('button', { name: /^Pagar \d/ }).click();
  57  |   await phone.waitForURL(/fake-psp\/checkout/);
  58  |   const paidClickAt = Date.now();
  59  |   await phone.getByRole('button', { name: 'Pagar', exact: true }).click();
  60  |   await expect(phone.getByRole('heading', { name: '¡Pago completado!' })).toBeVisible({ timeout: 20_000 });
  61  |   const scanToPaid = (Date.now() - scannedAt) / 1000;
  62  |   test.info().annotations.push({ type: 'criterio 1', description: `${scanToPaid.toFixed(1)} s del escaneo al pago` });
  63  |   expect(scanToPaid).toBeLessThan(30);
  64  | 
  65  |   // 5) La sala ve la mesa pagada sin recargar (criterio 5: < 3 s).
  66  |   await expect(floorStatus(desk, 'Mesa 1')).toHaveAttribute('aria-label', /Pagada/, { timeout: 3_000 });
  67  |   test.info().annotations.push({ type: 'criterio 5', description: `${((Date.now() - paidClickAt) / 1000).toFixed(1)} s hasta «Pagada» en la sala` });
  68  | 
  69  |   // 2) Guardar los puntos con el número de demo: alta con código y consentimientos.
  70  |   await expect(phone.getByRole('heading', { name: /Has ganado 33 puntos/ })).toBeVisible();
  71  |   await phone.getByLabel('Tu móvil').fill('600 000 000');
  72  |   await phone.getByRole('button', { name: 'Recibir código' }).click();
  73  |   await phone.getByLabel('Código').fill('000000');
  74  |   await phone.getByLabel('Tu nombre (opcional)').fill('Demo');
  75  |   await phone.getByLabel(/Acepto las condiciones/).check();
  76  |   await phone.getByLabel(/Compartir mis datos con Casa Pepe/).check();
  77  |   await phone.getByRole('button', { name: 'Guardar mis 33 puntos' }).click();
  78  |   await expect(phone.getByText('+33 puntos guardados')).toBeVisible();
  79  |   await expect(phone.getByText(/Vuelve y te invitamos/)).toBeVisible();
  80  | 
  81  |   // 3) Volver otro día: pagar la Mesa 2 con el cupón de bienvenida; los puntos llegan solos.
  82  |   await phone.goto(mesa2, { waitUntil: 'networkidle' });
> 83  |   await expect(phone.getByText('Mis puntos y cupones →')).toBeVisible();
      |                                                           ^ Error: expect(locator).toBeVisible() failed
  84  |   await phone.getByText(/Vuelve y te invitamos/).click();
  85  |   await expect(phone.locator('.totals .discount')).toContainText('−5,00');
  86  |   await expect(phone.getByRole('button', { name: /^Pagar 60,60/ })).toBeVisible();
  87  |   await phone.getByRole('button', { name: /^Pagar 60,60/ }).click();
  88  |   await phone.waitForURL(/fake-psp\/checkout/);
  89  |   await phone.getByRole('button', { name: 'Pagar', exact: true }).click();
  90  |   await expect(phone.getByRole('heading', { name: '¡Pago completado!' })).toBeVisible({ timeout: 20_000 });
  91  |   await expect(phone.locator('.receipt')).toContainText('−5,00');
  92  |   await expect(phone.getByText('+60 puntos')).toBeVisible({ timeout: 10_000 });
  93  | 
  94  |   // 4) En su cuenta: 93 puntos y una recompensa canjeable.
  95  |   await phone.goto(`${WEB_QR}/cuenta`, { waitUntil: 'networkidle' });
  96  |   await expect(phone.getByText('93 pts')).toBeVisible();
  97  |   await phone.locator('.rewards li', { hasText: 'Postre gratis' }).getByRole('button', { name: 'Canjear' }).click();
  98  |   await expect(phone.getByText(/Cupón de 6,00/)).toBeVisible();
  99  | 
  100 |   // 6) El comercio lo ve en la analítica y en su promoción.
  101 |   await desk.goto(`${PANEL}/analitica?period=today`);
  102 |   const identified = desk.locator('.tile', { hasText: 'Clientes identificados' });
  103 |   await expect(identified.locator('.tile-value')).toHaveText('1');
  104 |   await expect(desk.locator('.tile', { hasText: 'Descuentos con cupón' }).locator('.tile-value')).toContainText('5,00');
  105 |   await desk.goto(`${PANEL}/promociones`);
  106 |   await expect(desk.locator('.promo').first()).toContainText('1 cupones emitidos · 1 canjeados');
  107 | });
  108 | 
```
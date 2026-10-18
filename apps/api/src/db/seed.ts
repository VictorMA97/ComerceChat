// Datos de prueba de la PoC (ARCHITECTURE §16.4). Borra y recrea todo: solo para entornos locales.
// Uso: pnpm db:seed. Crece con cada hito (P2: caja simulada con carta y cuentas abiertas;
// P4: fidelización y cupones).
import { sql } from 'drizzle-orm';
import { hashPassword } from '../auth/passwords.js';
import { newId } from '../common/ids.js';
import { encryptPii, hashPii } from '../common/pii.js';
import { loadEnv } from '../config/env.js';
import { generateShortCode, qrUrl, signQr } from '../qr/qr-signature.js';
import { createDatabase } from './client.js';
import * as s from './schema/index.js';

const env = loadEnv();
if (env.NODE_ENV === 'production') throw new Error('El seed no puede ejecutarse en producción');

const PASSWORD = 'poc1234';
const TABLES_PER_LOCATION = 8;

/** Carta del TPV simulado (céntimos). */
const MENU: { category: string; name: string; priceCents: number }[] = [
  { category: 'Bebidas', name: 'Caña', priceCents: 250 },
  { category: 'Bebidas', name: 'Copa de vino tinto', priceCents: 380 },
  { category: 'Bebidas', name: 'Vermut de grifo', priceCents: 350 },
  { category: 'Bebidas', name: 'Agua mineral', priceCents: 200 },
  { category: 'Bebidas', name: 'Refresco', priceCents: 280 },
  { category: 'Bebidas', name: 'Café', priceCents: 180 },
  { category: 'Para compartir', name: 'Patatas bravas', priceCents: 650 },
  { category: 'Para compartir', name: 'Croquetas de jamón (6 uds.)', priceCents: 900 },
  { category: 'Para compartir', name: 'Pimientos de Padrón', priceCents: 750 },
  { category: 'Para compartir', name: 'Tortilla de patata', priceCents: 850 },
  { category: 'Para compartir', name: 'Ensaladilla rusa', priceCents: 800 },
  { category: 'Para compartir', name: 'Jamón ibérico (ración)', priceCents: 1900 },
  { category: 'Principales', name: 'Huevos rotos con jamón', priceCents: 1250 },
  { category: 'Principales', name: 'Calamares a la romana', priceCents: 1300 },
  { category: 'Principales', name: 'Secreto ibérico', priceCents: 1650 },
  { category: 'Principales', name: 'Bacalao confitado', priceCents: 1750 },
  { category: 'Principales', name: 'Hamburguesa de ternera', priceCents: 1400 },
  { category: 'Postres', name: 'Tarta de queso', priceCents: 600 },
  { category: 'Postres', name: 'Torrija', priceCents: 550 },
  { category: 'Postres', name: 'Flan casero', priceCents: 450 },
];

/** Cuentas abiertas al cargar los datos: [número de mesa, platos (nombre, cantidad)]. */
const OPEN_BILLS: [number, [string, number][]][] = [
  [
    1,
    [
      ['Caña', 2],
      ['Patatas bravas', 1],
      ['Croquetas de jamón (6 uds.)', 1],
      ['Huevos rotos con jamón', 1],
    ],
  ],
  [
    2,
    [
      ['Copa de vino tinto', 2],
      ['Jamón ibérico (ración)', 1],
      ['Secreto ibérico', 2],
      ['Tarta de queso', 1],
    ],
  ],
  [
    3,
    [
      ['Vermut de grifo', 1],
      ['Tortilla de patata', 1],
    ],
  ],
];

const MERCHANTS = [
  {
    legalName: 'Casa Pepe Hostelería S.L.',
    taxId: 'B00000001',
    brandName: 'Casa Pepe',
    users: [
      { email: 'owner@casapepe.test', role: 'OWNER' as const },
      { email: 'staff@casapepe.test', role: 'STAFF' as const },
    ],
    location: {
      name: 'Casa Pepe Malasaña',
      address: 'Calle del Espíritu Santo, Malasaña, 28004 Madrid',
      geo: { lng: -3.7052, lat: 40.4262 },
      category: 'restaurant',
    },
  },
  {
    legalName: 'La Tasca de Ana S.L.',
    taxId: 'B00000002',
    brandName: 'La Tasca de Ana',
    users: [{ email: 'owner@tascadeana.test', role: 'OWNER' as const }],
    location: {
      name: 'La Tasca de Ana Ponzano',
      address: 'Calle de Ponzano, Chamberí, 28010 Madrid',
      geo: { lng: -3.7009, lat: 40.4415 },
      category: 'restaurant',
    },
  },
];

const DINERS = [
  { phone: '+34600000001', name: 'Lucía' },
  { phone: '+34600000002', name: 'Marcos' },
  { phone: '+34600000003', name: 'Inés' },
];

const { db, pool } = createDatabase(env.DATABASE_URL);

try {
  const passwordHash = await hashPassword(PASSWORD);
  const printed: string[] = [];

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      truncate table audit_logs, outbox_events, idempotency_keys, psp_webhook_events, transactions,
        payments, order_items, orders, fake_psp_sessions, fake_pos_payments, fake_pos_bill_items,
        fake_pos_bills, fake_pos_menu_items, fake_pos_locations, user_consents, users, qr_codes,
        tables, merchant_locations, merchant_users, merchants restart identity cascade
    `);

    for (const m of MERCHANTS) {
      const [merchant] = await tx
        .insert(s.merchants)
        .values({
          legalName: m.legalName,
          taxId: m.taxId,
          brandName: m.brandName,
          // En la PoC no hay KYB real: el comercio se crea ya activo (SPEC §3.3).
          status: 'ACTIVE',
          psp: env.PAYMENT_PROVIDER,
          pspKybStatus: 'APPROVED_SIMULATED',
        })
        .returning();

      await tx
        .insert(s.merchantUsers)
        .values(m.users.map((u) => ({ ...u, merchantId: merchant!.id, passwordHash })));

      const [location] = await tx
        .insert(s.merchantLocations)
        .values({ merchantId: merchant!.id, ...m.location })
        .returning();

      const tableRows = await tx
        .insert(s.tables)
        .values(
          Array.from({ length: TABLES_PER_LOCATION }, (_, i) => ({
            locationId: location!.id,
            label: `Mesa ${i + 1}`,
            capacity: i < 4 ? 2 : 4,
            // Identificador de la mesa en el software de caja (simulado).
            externalTableId: `M${i + 1}`,
          })),
        )
        .returning();

      const qrs = tableRows.map((t) => {
        const id = newId();
        const q = { id, locationId: location!.id, tableId: t.id, version: 1 };
        return {
          ...q,
          type: 'STATIC_TABLE' as const,
          shortCode: generateShortCode(),
          signature: signQr(env.QR_HMAC_SECRET, q),
        };
      });
      await tx.insert(s.qrCodes).values(qrs);

      // Software de caja simulado: carta y cuentas abiertas (ARCHITECTURE §16.4).
      await tx.insert(s.fakePosLocations).values({ locationId: location!.id, healthy: true });
      await tx
        .insert(s.fakePosMenuItems)
        .values(MENU.map((item) => ({ locationId: location!.id, ...item })));
      for (const [tableNumber, items] of OPEN_BILLS) {
        const [bill] = await tx
          .insert(s.fakePosBills)
          .values({ locationId: location!.id, externalTableId: `M${tableNumber}` })
          .returning();
        await tx.insert(s.fakePosBillItems).values(
          items.map(([name, qty]) => ({
            billId: bill!.id,
            name,
            qty,
            unitPriceCents: MENU.find((m) => m.name === name)!.priceCents,
          })),
        );
      }
      printed.push(`  ${m.brandName}: ${qrUrl(env.WEB_QR_BASE_URL, qrs[0]!.shortCode)}  (Mesa 1)`);
    }

    for (const d of DINERS) {
      const [user] = await tx
        .insert(s.users)
        .values({
          phoneE164Enc: encryptPii(d.phone, env.PII_ENCRYPTION_KEY),
          phoneHash: hashPii(d.phone, env.PII_ENCRYPTION_KEY),
          name: d.name,
        })
        .returning();
      await tx.insert(s.userConsents).values({
        userId: user!.id,
        type: 'TERMS',
        granted: true,
        version: 'poc-1',
        source: 'seed',
      });
    }
  });

  console.log(`Seed completado.
  Panel: owner@casapepe.test · staff@casapepe.test · owner@tascadeana.test (contraseña: ${PASSWORD})
  Cuentas abiertas en las mesas ${OPEN_BILLS.map(([n]) => n).join(', ')} de cada local.
  Comensales: ${DINERS.map((d) => d.phone).join(', ')}
  QR de ejemplo:
${printed.join('\n')}`);
} finally {
  await pool.end();
}

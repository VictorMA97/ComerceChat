// Datos de prueba de la PoC (ARCHITECTURE §16.4). Borra y recrea todo: solo para entornos locales.
// Uso: pnpm db:seed. Crece con cada hito (carta en P2, fidelización y cupones en P4).
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
      truncate table audit_logs, outbox_events, user_consents, users, qr_codes, tables,
        merchant_locations, merchant_users, merchants restart identity cascade
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
      await tx
        .insert(s.userConsents)
        .values({ userId: user!.id, type: 'TERMS', granted: true, version: 'poc-1', source: 'seed' });
    }
  });

  console.log(`Seed completado.
  Panel: owner@casapepe.test · staff@casapepe.test · owner@tascadeana.test (contraseña: ${PASSWORD})
  Comensales: ${DINERS.map((d) => d.phone).join(', ')}
  QR de ejemplo:
${printed.join('\n')}`);
} finally {
  await pool.end();
}

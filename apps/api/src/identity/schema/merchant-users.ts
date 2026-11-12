import { identitySchema } from './pg-schema.js';
import { boolean, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from '../../db/schema/columns.js';
import { merchantUserRole } from './enums.js';

export const merchantUsers = identitySchema.table('merchant_users', {
  id: id(),
  merchantId: uuid('merchant_id').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: merchantUserRole('role').notNull(),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  /** Secreto TOTP cifrado con AES-256-GCM (ADR-025). Nulo hasta que se activa el doble factor. */
  mfaSecretEnc: text('mfa_secret_enc'),
  mfaEnabledAt: timestamp('mfa_enabled_at', { withTimezone: true }),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Códigos de recuperación del doble factor: cada uno vale una sola vez. Se guarda su HMAC, nunca el
 * código en claro (ADR-025).
 */
export const merchantUserRecoveryCodes = identitySchema.table(
  'merchant_user_recovery_codes',
  {
    id: id(),
    merchantUserId: uuid('merchant_user_id')
      .notNull()
      .references(() => merchantUsers.id),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('merchant_user_recovery_codes_uq').on(t.merchantUserId, t.codeHash)],
);

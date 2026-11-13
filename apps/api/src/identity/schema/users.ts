import { identitySchema } from './pg-schema.js';
import { boolean, date, index, integer, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from '@comercechat/service-kit/db';
import { consentType, userStatus } from './enums.js';

export const users = identitySchema.table('users', {
  id: id(),
  phoneE164Enc: text('phone_e164_enc').notNull(),
  phoneHash: text('phone_hash').notNull().unique(),
  emailEnc: text('email_enc'),
  name: text('name'),
  birthdate: date('birthdate'),
  locale: text('locale').notNull().default('es'),
  status: userStatus('status').notNull().default('ACTIVE'),
  riskScore: integer('risk_score').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Consentimientos de solo-inserción y versionados: el último registro manda (ADR-016). */
export const userConsents = identitySchema.table(
  'user_consents',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: consentType('type').notNull(),
    merchantId: uuid('merchant_id'),
    granted: boolean('granted').notNull(),
    version: text('version').notNull(),
    source: text('source').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('user_consents_lookup_idx').on(t.userId, t.type, t.merchantId, t.createdAt)],
);

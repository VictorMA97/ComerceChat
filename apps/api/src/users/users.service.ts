import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ConsentsInput, MeView } from '@comercechat/shared-types';
import { and, desc, eq } from 'drizzle-orm';
import { AppError } from '../common/app-error.js';
import { encryptPii, decryptPii, hashPii } from '../common/pii.js';
import { ENV, type Env } from '../config/env.js';
import { DB, type Database } from '../db/client.js';
import { merchants, userConsents, users } from '../db/schema/index.js';
import { maskPhone } from './phone.js';

/** Versión de los textos legales aceptados (se guarda con cada consentimiento, ADR-016). */
export const CONSENT_VERSION = 'poc-2026-10';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Crea el usuario o recupera el existente por el hash del teléfono (el número va cifrado). */
  async upsertByPhone(
    phone: string,
    name: string | undefined,
  ): Promise<{ id: string; isNew: boolean }> {
    const phoneHash = hashPii(phone, this.env.PII_ENCRYPTION_KEY);
    const existing = await this.db.query.users.findFirst({ where: eq(users.phoneHash, phoneHash) });
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        throw new AppError('USER_BLOCKED', HttpStatus.FORBIDDEN, 'Esta cuenta no está disponible');
      }
      return { id: existing.id, isNew: false };
    }
    const [created] = await this.db
      .insert(users)
      .values({
        phoneE164Enc: encryptPii(phone, this.env.PII_ENCRYPTION_KEY),
        phoneHash,
        name: name?.trim() || null,
      })
      .onConflictDoNothing({ target: users.phoneHash })
      .returning({ id: users.id });
    if (created) return { id: created.id, isNew: true };
    const again = await this.db.query.users.findFirst({ where: eq(users.phoneHash, phoneHash) });
    return { id: again!.id, isNew: false };
  }

  /** Registra consentimientos (solo inserción). Los términos son obligatorios para crear la cuenta. */
  async recordConsents(userId: string, c: ConsentsInput, source: string): Promise<void> {
    const rows: (typeof userConsents.$inferInsert)[] = [
      { userId, type: 'TERMS', granted: c.terms, version: CONSENT_VERSION, source },
      { userId, type: 'MKT_PLATFORM', granted: c.marketing, version: CONSENT_VERSION, source },
    ];
    if (c.shareWithMerchantId) {
      rows.push({
        userId,
        type: 'SHARE_WITH_MERCHANT',
        merchantId: c.shareWithMerchantId,
        granted: true,
        version: CONSENT_VERSION,
        source,
      });
    }
    await this.db.insert(userConsents).values(rows);
  }

  async setMerchantShare(userId: string, merchantId: string, granted: boolean): Promise<void> {
    await this.db.insert(userConsents).values({
      userId,
      type: 'SHARE_WITH_MERCHANT',
      merchantId,
      granted,
      version: CONSENT_VERSION,
      source: 'profile',
    });
  }

  async setMarketing(userId: string, granted: boolean): Promise<void> {
    await this.db.insert(userConsents).values({
      userId,
      type: 'MKT_PLATFORM',
      granted,
      version: CONSENT_VERSION,
      source: 'profile',
    });
  }

  async hasAcceptedTerms(userId: string): Promise<boolean> {
    const [last] = await this.db
      .select({ granted: userConsents.granted })
      .from(userConsents)
      .where(and(eq(userConsents.userId, userId), eq(userConsents.type, 'TERMS')))
      .orderBy(desc(userConsents.createdAt))
      .limit(1);
    return last?.granted === true;
  }

  async me(userId: string): Promise<MeView> {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user)
      throw new AppError(
        'UNAUTHENTICATED',
        HttpStatus.UNAUTHORIZED,
        'Inicia sesión con tu teléfono',
      );
    // Consentimientos: el último registro de cada tipo (y comercio) manda.
    const rows = await this.db
      .select({ consent: userConsents, brandName: merchants.brandName })
      .from(userConsents)
      .leftJoin(merchants, eq(merchants.id, userConsents.merchantId))
      .where(eq(userConsents.userId, userId))
      .orderBy(desc(userConsents.createdAt));
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
      const k = `${r.consent.type}:${r.consent.merchantId ?? ''}`;
      if (!latest.has(k)) latest.set(k, r);
    }
    const last = (type: string) => latest.get(`${type}:`)?.consent.granted ?? false;
    return {
      id: user.id,
      phoneMasked: maskPhone(decryptPii(user.phoneE164Enc, this.env.PII_ENCRYPTION_KEY)),
      name: user.name,
      consents: {
        terms: last('TERMS'),
        marketing: last('MKT_PLATFORM'),
        sharedWith: [...latest.values()]
          .filter(
            (r) =>
              r.consent.type === 'SHARE_WITH_MERCHANT' && r.consent.granted && r.consent.merchantId,
          )
          .map((r) => ({ merchantId: r.consent.merchantId!, brandName: r.brandName ?? '' })),
      },
    };
  }
}

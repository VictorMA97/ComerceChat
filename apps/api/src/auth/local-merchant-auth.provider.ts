import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/client.js';
import { merchantUsers } from '../db/schema/index.js';
import type { MerchantAuthProvider, MerchantPrincipal } from './auth.types.js';
import { hashPassword, verifyPassword } from './passwords.js';

@Injectable()
export class LocalMerchantAuthProvider implements MerchantAuthProvider {
  // Hash señuelo: si el email no existe se verifica igualmente para no revelarlo por tiempo de respuesta.
  private readonly decoyHash = hashPassword('decoy-password-not-used');

  constructor(@Inject(DB) private readonly db: Database) {}

  async authenticate(email: string, password: string): Promise<MerchantPrincipal | null> {
    const user = await this.db.query.merchantUsers.findFirst({
      where: eq(merchantUsers.email, email.trim().toLowerCase()),
    });
    const valid = await verifyPassword(user?.passwordHash ?? (await this.decoyHash), password);
    if (!user || !valid || user.status !== 'ACTIVE') return null;
    return { merchantUserId: user.id, merchantId: user.merchantId, role: user.role };
  }
}

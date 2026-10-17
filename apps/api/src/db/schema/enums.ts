import {
  ConsentType,
  MerchantStatus,
  MerchantUserRole,
  QrCodeStatus,
  QrCodeType,
  UserStatus,
} from '@comercechat/shared-types';
import { pgEnum } from 'drizzle-orm/pg-core';

const values = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];

export const merchantStatus = pgEnum('merchant_status', values(MerchantStatus));
export const merchantUserRole = pgEnum('merchant_user_role', values(MerchantUserRole));
export const qrCodeType = pgEnum('qr_code_type', values(QrCodeType));
export const qrCodeStatus = pgEnum('qr_code_status', values(QrCodeStatus));
export const userStatus = pgEnum('user_status', values(UserStatus));
export const consentType = pgEnum('consent_type', values(ConsentType));

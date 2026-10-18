import {
  AllocationStatus,
  ConsentType,
  MerchantStatus,
  MerchantUserRole,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  QrCodeStatus,
  QrCodeType,
  TransactionType,
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
export const orderSource = pgEnum('order_source', values(OrderSource));
export const orderStatus = pgEnum('order_status', values(OrderStatus));
export const paymentMethod = pgEnum('payment_method', values(PaymentMethod));
export const paymentStatus = pgEnum('payment_status', values(PaymentStatus));
export const transactionType = pgEnum('transaction_type', values(TransactionType));
export const allocationStatus = pgEnum('allocation_status', values(AllocationStatus));

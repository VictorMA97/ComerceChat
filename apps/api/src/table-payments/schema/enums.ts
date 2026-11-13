import {
  AllocationStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  QrCodeStatus,
  TransactionType,
} from '@comercechat/shared-types';
import { enumValues } from '@comercechat/service-kit/db';
import { paymentsSchema } from './pg-schema.js';

export const orderSource = paymentsSchema.enum('order_source', enumValues(OrderSource));
export const orderStatus = paymentsSchema.enum('order_status', enumValues(OrderStatus));
export const paymentMethod = paymentsSchema.enum('payment_method', enumValues(PaymentMethod));
export const paymentStatus = paymentsSchema.enum('payment_status', enumValues(PaymentStatus));
export const transactionType = paymentsSchema.enum('transaction_type', enumValues(TransactionType));
export const allocationStatus = paymentsSchema.enum(
  'allocation_status',
  enumValues(AllocationStatus),
);
export const paymentQrStatus = paymentsSchema.enum('payment_qr_status', enumValues(QrCodeStatus));

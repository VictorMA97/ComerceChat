import { MerchantStatus, QrCodeStatus, QrCodeType } from '@comercechat/shared-types';
import { enumValues } from '../../db/schema/columns.js';
import { venuesSchema } from './pg-schema.js';

export const merchantStatus = venuesSchema.enum('merchant_status', enumValues(MerchantStatus));
export const qrCodeType = venuesSchema.enum('qr_code_type', enumValues(QrCodeType));
export const qrCodeStatus = venuesSchema.enum('qr_code_status', enumValues(QrCodeStatus));

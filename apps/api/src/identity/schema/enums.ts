import { ConsentType, MerchantUserRole, UserStatus } from '@comercechat/shared-types';
import { enumValues } from '@comercechat/service-kit/db';
import { identitySchema } from './pg-schema.js';

export const merchantUserRole = identitySchema.enum(
  'merchant_user_role',
  enumValues(MerchantUserRole),
);
export const userStatus = identitySchema.enum('user_status', enumValues(UserStatus));
export const consentType = identitySchema.enum('consent_type', enumValues(ConsentType));

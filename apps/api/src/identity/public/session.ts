// Sesiones del panel y del comensal para el resto de contextos (ADR-029). Con servicios separados,
// estos guards validarán la sesión llamando a identity (MIGRACION §3.3).
export type { MerchantPrincipal } from '../auth/auth.types.js';
export { CurrentMerchant, MerchantAuthGuard, MerchantRoles } from '../auth/merchant-auth.guard.js';
export { CurrentUserId, OptionalUserGuard, UserAuthGuard } from '../users/user-auth.js';

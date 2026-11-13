// Sesiones del panel y del comensal para cualquier servicio (ADR-029, MIGRACION §3.2): guards y
// decoradores que validan el token contra identity a través de MerchantSessionVerifier y
// UserSessionVerifier. Quien monta el servicio decide la implementación (en proceso o por HTTP).
export * from './merchant.js';
export * from './http-verifier.js';
export * from './user.js';

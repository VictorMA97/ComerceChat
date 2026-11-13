// Contratos entre los servicios de ComerceChat (ADR-029, MIGRACION §3.2): eventos de dominio y, más
// adelante, los DTO de las rutas /internal/*. Lo que ven las apps Next sigue en shared-types.
export * from './events.js';
// Firma de los webhooks del PSP simulado: contrato entre services/fake-psp y la API (MS F3).
export * from './fake-psp-signature.js';
export * from './venues.js';

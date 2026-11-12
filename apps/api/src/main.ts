import 'reflect-metadata';
import { loadEnv } from './config/env.js';
import { startTelemetry } from './telemetry.js';

// Valida el entorno antes de levantar nada: falla si hay simuladores en producción (ADR-018).
const env = loadEnv();
// La telemetría va antes que la app: sus hooks solo instrumentan los módulos importados después.
const stopTelemetry = startTelemetry(env);
const { startServer } = await import('./server.js');
await startServer(env, stopTelemetry);

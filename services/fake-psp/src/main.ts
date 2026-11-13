import 'reflect-metadata';
import { startTelemetry } from '@comercechat/service-kit/telemetry';
import { loadEnv } from './config/env.js';

// La telemetría va antes que la app: sus hooks solo instrumentan los módulos importados después.
startTelemetry(loadEnv(), 'comercechat-fake-psp');
const { startServer } = await import('./server.js');
await startServer();

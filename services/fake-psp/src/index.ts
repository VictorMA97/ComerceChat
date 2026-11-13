// PSP simulado como servicio (MS F3). Lo importan solo los tests de la API, que lo levantan en su
// proceso; el adaptador de la API usa la subruta `@comercechat/fake-psp/signature`.
export { createFakePspApp } from './server.js';
export { fakePspSessions } from './db/schema.js';

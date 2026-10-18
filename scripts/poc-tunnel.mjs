// Túnel HTTPS para probar la web QR desde el móvil (Cloudflare quick tunnel vía Docker).
// Uso:
//   pnpm poc:tunnel         arranca el túnel (o reutiliza el que ya hay) y apunta los QR a su URL
//   pnpm poc:tunnel --stop  para el túnel y vuelve a http://localhost:3000
// Los QR guardados no llevan la URL base y la API la relee de .env.local: no hace falta reiniciar `pnpm dev`.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
const LOCAL_URL = 'http://localhost:3000';
const compose = (...args) =>
  execFileSync('docker', ['compose', '--profile', 'tunnel', ...args], {
    cwd: root,
    encoding: 'utf8',
  });

function setWebQrBaseUrl(url) {
  let env;
  try {
    env = readFileSync(envFile, 'utf8');
  } catch {
    console.error('Falta .env.local: ejecuta antes `pnpm poc:keys`.');
    process.exit(1);
  }
  const line = `WEB_QR_BASE_URL=${url}`;
  env = /^WEB_QR_BASE_URL=.*$/m.test(env)
    ? env.replace(/^WEB_QR_BASE_URL=.*$/m, line)
    : `${env.trimEnd()}\n${line}\n`;
  writeFileSync(envFile, env, { mode: 0o600 });
}

if (process.argv.includes('--stop')) {
  compose('stop', 'tunnel');
  setWebQrBaseUrl(LOCAL_URL);
  console.log(
    `Túnel parado. WEB_QR_BASE_URL=${LOCAL_URL}. La API y el panel lo aplican en unos segundos.`,
  );
  process.exit(0);
}

compose('up', '-d', 'tunnel');

// Cada arranque del contenedor publica una URL nueva, pero `docker compose logs` conserva las de
// arranques anteriores: solo se leen los logs desde el arranque actual.
const containerId = compose('ps', '-q', 'tunnel').trim();
const startedAt = execFileSync('docker', ['inspect', '-f', '{{.State.StartedAt}}', containerId], {
  encoding: 'utf8',
}).trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let url;
for (let i = 0; i < 60 && !url; i++) {
  const logs = compose('logs', '--no-color', '--since', startedAt, 'tunnel');
  url = [...logs.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)].at(-1)?.[0];
  if (!url) await sleep(1000);
}
if (!url) {
  console.error('El túnel no ha publicado su URL en 60 s. Revisa: docker compose logs tunnel');
  process.exit(1);
}

setWebQrBaseUrl(url);

// La URL tarda unos segundos en resolverse en DNS. Se comprueba que responde de verdad.
let reachable = false;
for (let i = 0; i < 30 && !reachable; i++) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    reachable = res.status < 500;
  } catch {
    await sleep(1000);
  }
}
if (!reachable) {
  console.warn(`  Aviso: ${url} aún no responde. ¿Está arrancado \`pnpm dev\` (web QR en :3000)?`);
}
console.log(`
  Túnel activo: ${url}
  WEB_QR_BASE_URL actualizado en .env.local.
  Los QR del panel usan esta URL en unos segundos (no hace falta reiniciar \`pnpm dev\`).
  Aviso: cualquiera con la URL puede abrir la web QR mientras el túnel esté activo.
`);

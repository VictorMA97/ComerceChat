// Genera .env.local a partir de .env.example con secretos aleatorios.
// Si ya existe, solo añade los secretos que le falten (p. ej. los que llegan en una versión nueva).
// Uso: pnpm poc:keys [--force]
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env.local');
const force = process.argv.includes('--force');

const { privateKey } = generateKeyPairSync('ed25519');
const secrets = {
  JWT_SECRET: randomBytes(32).toString('base64url'),
  QR_HMAC_SECRET: randomBytes(32).toString('base64url'),
  // Clave Ed25519 en PKCS#8 DER base64url, para los QR dinámicos (P3).
  QR_SIGNING_KEY: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url'),
  PII_ENCRYPTION_KEY: randomBytes(32).toString('base64url'),
  FAKE_PSP_WEBHOOK_SECRET: randomBytes(32).toString('base64url'),
  PAYMENT_STATUS_SECRET: randomBytes(32).toString('base64url'),
  INTERNAL_PROXY_SECRET: randomBytes(32).toString('base64url'),
};

if (existsSync(target) && !force) {
  const current = readFileSync(target, 'utf8');
  const missing = Object.keys(secrets).filter(
    (key) => !new RegExp(`^${key}=.+$`, 'm').test(current),
  );
  if (missing.length === 0) {
    console.log('.env.local ya existe; no se sobrescribe (usa --force para regenerar).');
    process.exit(0);
  }
  // Una clave que esté vacía (`KEY=`) se rellena en su línea; si no está, se añade al final.
  let updated = current;
  const appended = [];
  for (const key of missing) {
    const empty = new RegExp(`^${key}=$`, 'm');
    if (empty.test(updated)) updated = updated.replace(empty, `${key}=${secrets[key]}`);
    else appended.push(`${key}=${secrets[key]}`);
  }
  writeFileSync(target, updated, { mode: 0o600 });
  if (appended.length) {
    appendFileSync(target, `${updated.endsWith('\n') ? '' : '\n'}${appended.join('\n')}\n`);
  }
  console.log(`.env.local: añadidos los secretos que faltaban (${missing.join(', ')}).`);
  process.exit(0);
}

const env = readFileSync(join(root, '.env.example'), 'utf8')
  .split('\n')
  .map((line) => {
    const key = line.split('=')[0];
    return key in secrets ? `${key}=${secrets[key]}` : line;
  })
  .join('\n');

writeFileSync(target, env, { mode: 0o600 });
console.log('.env.local generado con secretos nuevos.');

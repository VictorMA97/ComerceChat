// Genera .env.local a partir de .env.example con secretos aleatorios.
// Uso: pnpm poc:keys [--force]
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env.local');
const force = process.argv.includes('--force');

if (existsSync(target) && !force) {
  console.log('.env.local ya existe; no se sobrescribe (usa --force para regenerar).');
  process.exit(0);
}

const { privateKey } = generateKeyPairSync('ed25519');
const secrets = {
  JWT_SECRET: randomBytes(32).toString('base64url'),
  QR_HMAC_SECRET: randomBytes(32).toString('base64url'),
  // Clave Ed25519 en PKCS#8 DER base64url, para los QR dinámicos (P3).
  QR_SIGNING_KEY: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url'),
  PII_ENCRYPTION_KEY: randomBytes(32).toString('base64url'),
  FAKE_PSP_WEBHOOK_SECRET: randomBytes(32).toString('base64url'),
};

const env = readFileSync(join(root, '.env.example'), 'utf8')
  .split('\n')
  .map((line) => {
    const key = line.split('=')[0];
    return key in secrets ? `${key}=${secrets[key]}` : line;
  })
  .join('\n');

writeFileSync(target, env, { mode: 0o600 });
console.log('.env.local generado con secretos nuevos.');

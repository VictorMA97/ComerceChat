import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
const LOCAL = 'http://localhost:3000';

function setWebQrBaseUrl(url: string): string | null {
  const env = readFileSync(envFile, 'utf8');
  const previous = /^WEB_QR_BASE_URL=(.*)$/m.exec(env)?.[1] ?? null;
  writeFileSync(envFile, env.replace(/^WEB_QR_BASE_URL=.*$/m, `WEB_QR_BASE_URL=${url}`), {
    mode: 0o600,
  });
  return previous;
}

/**
 * - Datos de prueba limpios: el recorrido usa el número de demo, que no debe existir aún.
 * - Durante el test, los QR y las redirecciones apuntan a localhost (aunque haya un túnel
 *   configurado): todo el recorrido ocurre en el mismo dominio y la cookie de sesión vale en todas
 *   las páginas. La API relee WEB_QR_BASE_URL en caliente; al terminar se restaura el valor.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const previous = setWebQrBaseUrl(LOCAL);
  // La API relee .env.local como mucho cada 2 s.
  await new Promise((r) => setTimeout(r, 2_500));
  execFileSync('pnpm', ['db:seed'], { cwd: root, stdio: 'inherit' });
  return async () => {
    if (previous && previous !== LOCAL) setWebQrBaseUrl(previous);
  };
}

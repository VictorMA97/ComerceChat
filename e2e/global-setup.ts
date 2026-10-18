import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Datos de prueba limpios: el recorrido usa el número de demo, que no debe existir aún. */
export default function globalSetup(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  execFileSync('pnpm', ['db:seed'], { cwd: root, stdio: 'inherit' });
}

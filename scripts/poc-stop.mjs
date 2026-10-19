// Para la PoC local: termina los procesos que escuchan en los puertos de la app (3000, 3001, 4000) y
// los procesos de la API que hayan quedado huérfanos. Útil si `pnpm dev` no se cerró del todo.
// Uso: pnpm poc:stop
import { execFileSync } from 'node:child_process';

const PORTS = [3000, 3001, 4000];

function pidsListening() {
  let out = '';
  try {
    out = execFileSync('ss', ['-ltnpH'], { encoding: 'utf8' });
  } catch {
    return [];
  }
  return out
    .split('\n')
    .filter((line) => PORTS.some((p) => new RegExp(`:${p}\\s`).test(line)))
    .flatMap((line) => [...line.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1])));
}

function orphanApis() {
  const out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  return out
    .split('\n')
    .filter((l) => /apps\/api\/dist\/main/.test(l))
    .map((l) => Number(l.trim().split(/\s+/)[0]))
    .filter((pid) => pid !== process.pid);
}

const targets = [...new Set([...pidsListening(), ...orphanApis()])];
for (const pid of targets) {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    /* ya terminado */
  }
}
await new Promise((r) => setTimeout(r, 2000));
for (const pid of targets) {
  try {
    process.kill(pid, 0);
    process.kill(pid, 'SIGKILL');
  } catch {
    /* ya terminado */
  }
}
console.log(
  targets.length ? `Procesos parados: ${targets.join(', ')}` : 'No había nada en marcha.',
);

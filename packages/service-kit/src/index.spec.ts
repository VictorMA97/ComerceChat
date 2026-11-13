import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('índice del paquete', () => {
  // Con TELEMETRY=on, el hook ESM de OpenTelemetry (import-in-the-middle) envuelve los módulos y
  // descarta los nombres que llegan por más de un `export *`: el servicio no arranca («does not
  // provide an export named …»), aunque sin telemetría funcione. Cada nombre, por un solo camino.
  it('no exporta el mismo nombre desde dos módulos', async () => {
    const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    const seen = new Map<string, string[]>();
    for (const [, spec] of index.matchAll(/export \* from '(.+?)\.js'/g)) {
      const mod = (await import(`./${spec!.replace(/^\.\//, '')}.ts`)) as Record<string, unknown>;
      for (const name of Object.keys(mod)) seen.set(name, [...(seen.get(name) ?? []), spec!]);
    }
    expect([...seen].filter(([, from]) => from.length > 1)).toEqual([]);
  });
});

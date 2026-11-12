// Fronteras entre contextos de la API (ADR-029, docs/MIGRACION.md §3).
//
// Cada carpeta de primer nivel de `src` en CONTEXTS es un futuro microservicio. Un contexto solo
// puede usar de otro lo que este publique en `src/<contexto>/public/`; sus tablas están en
// `src/<contexto>/schema/` y nadie más las importa. El código compartido (SHARED) no depende de
// ningún contexto, salvo las raíces de composición, que montan la aplicación entera.
//
// Las violaciones que quedan por resolver en F1 están en .dependency-cruiser-known-violations.json:
// `pnpm lint` falla con cualquier violación nueva. Al terminar F1 ese fichero queda vacío.

const CONTEXTS =
  'identity|merchant-venues|table-payments|loyalty|audit|analytics|realtime|fake-psp|fake-pos';
const SHARED = 'common|config|contracts|db|redis|queue|outbox|health|pos';

/** Ficheros que montan la aplicación o el esquema completos: pueden importar cualquier contexto. */
const COMPOSITION_ROOTS = [
  '^src/app\\.module\\.ts$',
  '^src/server\\.ts$',
  '^src/main\\.ts$',
  '^src/pos/pos\\.module\\.ts$',
  '^src/db/schema/index\\.ts$',
  '^src/db/client\\.ts$',
  '^src/db/seed\\.ts$',
  '^src/db/migrate\\.ts$',
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'contexto-a-interno-de-otro',
      severity: 'error',
      comment:
        'Un contexto solo puede importar de otro lo que este expone en src/<contexto>/public/ ' +
        '(ADR-029). Las tablas de otro contexto nunca se importan: se piden a su API pública o ' +
        'llegan por eventos.',
      from: { path: `^src/(${CONTEXTS})/` },
      to: {
        path: `^src/(${CONTEXTS})/`,
        pathNot: ['^src/$1/', `^src/(${CONTEXTS})/public/`],
      },
    },
    {
      name: 'compartido-a-contexto',
      severity: 'error',
      comment:
        'El código compartido no depende de ningún contexto: al separar los servicios irá a ' +
        'packages/service-kit (MIGRACION §3.2).',
      from: { path: `^src/(${SHARED})/`, pathNot: COMPOSITION_ROOTS },
      to: { path: `^src/(${CONTEXTS})/` },
    },
    {
      name: 'esquema-completo-solo-en-raices',
      severity: 'error',
      comment:
        'src/db/schema/index.ts junta las tablas de todos los contextos. Cada contexto importa ' +
        'solo su propio src/<contexto>/schema/.',
      from: { pathNot: COMPOSITION_ROOTS },
      to: { path: '^src/db/schema/index\\.ts$' },
    },
    {
      name: 'sin-ciclos',
      severity: 'error',
      comment: 'Los ciclos impiden separar los contextos en servicios.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    includeOnly: '^src/',
    exclude: { path: '\\.spec\\.ts$' },
    // Los imports de solo tipos también acoplan contextos.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.js'],
    },
  },
};

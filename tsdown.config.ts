import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-ui-primitives',
]

export default defineConfig([
  {
    entry: { index: 'src/index.ts', observer: 'src/observer.ts' },
    dts: true,
    format: 'esm',
    outDir: 'lib',
    platform: 'node',
    splitting: false,
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    clean: false,
    splitting: false,
    external: clientExternals,
    noExternal: (id: string) => clientExternals.includes(id) ? undefined : true,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: "window.__ModuleLoader__.load({ id: 'dsh-opc', factory: (require) => {",
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])

const esbuild = require('esbuild');

const production = process.argv.includes('--production');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  platform: 'node',
  target: 'node20',
  minify: production,
  sourcemap: !production,
  sourcesContent: !production,
  format: 'cjs',
  tsconfig: 'tsconfig.json',
}).catch(() => process.exit(1));

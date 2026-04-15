import * as esbuild from 'esbuild';
import {readdirSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find all .ts files in src and subdirectories
const srcDir = join(__dirname, 'src');
const entryPoints = [];

function findTs(dir) {
  const files = readdirSync(dir, {withFileTypes: true});
  for (const f of files) {
    const fullPath = join(dir, f.name);
    if (f.isDirectory()) {
      findTs(fullPath);
    } else if (f.name.endsWith('.ts')) {
      entryPoints.push(fullPath);
    }
  }
}

findTs(srcDir);

await esbuild.build({
  entryPoints,
  bundle: true,
  platform: 'node',
  external: ['vscode'],
  outdir: join(__dirname, 'out'),
  format: 'cjs',
  sourcemap: true,
  splitting: false,
});

console.log(`Built ${entryPoints.length} files`);
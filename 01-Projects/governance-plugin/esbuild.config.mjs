import esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const outdir = resolve('../../.obsidian/plugins/observer-governance');

mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*'],
  format: 'cjs',
  target: 'es2020',
  outfile: resolve(outdir, 'main.js'),
  sourcemap: false,
  treeShaking: true,
  logLevel: 'info',
});

// Copy static files to plugin output
copyFileSync('manifest.json', resolve(outdir, 'manifest.json'));
copyFileSync('styles.css', resolve(outdir, 'styles.css'));

console.log('Build complete. Output:', outdir);

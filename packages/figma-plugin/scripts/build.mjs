/**
 * Build script for Figma Plugin.
 *
 * Figma plugins have two parts:
 * - Sandbox (main thread): Has access to Figma Plugin API, runs in a
 *   restricted environment. Cannot use `import` at runtime — must be
 *   a single self-contained file.
 * - UI (iframe): Standard HTML/JS/CSS. Can use fetch, etc.
 *
 * We build the sandbox as IIFE (single file) and copy the UI HTML as-is
 * (its JS is inline in the HTML).
 */

import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const isWatch = process.argv.includes('--watch');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const sharedAlias = {
  name: 'shared-alias',
  setup(build) {
    build.onResolve({ filter: /^@web-to-figma\/shared$/ }, () => ({
      path: resolve(rootDir, '../shared/src/index.ts'),
    }));
  },
};

function copyUI() {
  mkdirSync(resolve(distDir, 'ui'), { recursive: true });
  copyFileSync(
    resolve(rootDir, 'src/ui/index.html'),
    resolve(distDir, 'ui/index.html'),
  );
}

async function build() {
  const sandboxCtx = await esbuild.context({
    entryPoints: [resolve(rootDir, 'src/sandbox/index.ts')],
    outfile: resolve(distDir, 'sandbox/index.js'),
    bundle: true,
    format: 'iife',
    target: 'es2017',
    sourcemap: false,
    minify: false,
    plugins: [sharedAlias],
    logLevel: 'info',
  });

  if (isWatch) {
    await sandboxCtx.rebuild();
    copyUI();
    console.log('Initial build complete.');
    await sandboxCtx.watch();
    console.log('Watching for changes...');
  } else {
    await sandboxCtx.rebuild();
    await sandboxCtx.dispose();
    copyUI();
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

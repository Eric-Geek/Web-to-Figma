/**
 * Build script for Chrome Extension.
 *
 * Uses esbuild to bundle each entry point into a self-contained file.
 * Content scripts cannot use ES modules, so they are built as IIFE.
 * Background service worker and popup are built as ESM.
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

const commonOptions = {
  bundle: true,
  target: 'chrome116',
  sourcemap: false,
  minify: false,
  plugins: [sharedAlias],
  logLevel: 'info',
};

function copyStaticAssets() {
  copyFileSync(
    resolve(rootDir, 'src/manifest.json'),
    resolve(distDir, 'manifest.json'),
  );
  mkdirSync(resolve(distDir, 'popup'), { recursive: true });
  copyFileSync(
    resolve(rootDir, 'src/popup/index.html'),
    resolve(distDir, 'popup/index.html'),
  );
  mkdirSync(resolve(distDir, 'icons'), { recursive: true });
}

async function build() {
  const contentCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: [resolve(rootDir, 'src/content/index.ts')],
    outfile: resolve(distDir, 'content/index.js'),
    format: 'iife',
  });

  const backgroundCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: [resolve(rootDir, 'src/background/index.ts')],
    outfile: resolve(distDir, 'background/index.js'),
    format: 'esm',
  });

  const popupCtx = await esbuild.context({
    ...commonOptions,
    entryPoints: [resolve(rootDir, 'src/popup/index.ts')],
    outfile: resolve(distDir, 'popup/index.js'),
    format: 'esm',
  });

  if (isWatch) {
    // Do initial build + copy, then start watching
    await Promise.all([
      contentCtx.rebuild(),
      backgroundCtx.rebuild(),
      popupCtx.rebuild(),
    ]);
    copyStaticAssets();
    console.log('Initial build complete.');

    await Promise.all([
      contentCtx.watch(),
      backgroundCtx.watch(),
      popupCtx.watch(),
    ]);
    console.log('Watching for changes...');
  } else {
    await Promise.all([
      contentCtx.rebuild(),
      backgroundCtx.rebuild(),
      popupCtx.rebuild(),
    ]);
    await Promise.all([
      contentCtx.dispose(),
      backgroundCtx.dispose(),
      popupCtx.dispose(),
    ]);
    copyStaticAssets();
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

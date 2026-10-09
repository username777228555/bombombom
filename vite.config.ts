import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * pdf.js needs its decoders and data next to the app: `wasm/` (JPEG 2000 and JBIG2 scans — without them pages of
 * scanned books render blank), `cmaps/` (Cyrillic CID fonts) and `standard_fonts/`. Served from node_modules in
 * dev and emitted as `dist/pdfjs/…` in the build (see loadPdfjs/pdfAssets in modules/library/books.ts).
 */
function pdfjsAssets(): Plugin {
  const root = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url));
  const DIRS = ['wasm', 'cmaps', 'standard_fonts'];
  const skip = (name: string) => name.startsWith('LICENSE') || name.startsWith('quickjs');
  return {
    name: 'pdfjs-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /\/pdfjs\/([a-z_]+)\/([^?#/]+)/.exec(req.url ?? '');
        const file = m && DIRS.includes(m[1]!) ? join(root, m[1]!, decodeURIComponent(m[2]!)) : null;
        if (!file || !existsSync(file) || !statSync(file).isFile()) return next();
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const dir of DIRS) {
        for (const name of readdirSync(join(root, dir))) {
          if (!skip(name)) this.emitFile({ type: 'asset', fileName: `pdfjs/${dir}/${name}`, source: readFileSync(join(root, dir, name)) });
        }
      }
    },
  };
}

export default defineConfig({
  // Relative base: the same build works inside the Android WebView and from any sub-path.
  base: './',
  plugins: [svelte(), pdfjsAssets()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: { $lib: fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    assetsInlineLimit: 2048,
  },
  server: { host: true, port: 5173 },
});

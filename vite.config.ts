import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative base: the same build works inside the Android WebView and from any sub-path.
  base: './',
  plugins: [svelte()],
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // Treat .onnx and .wasm binaries as static assets so Vite copies them
  // into dist/ instead of trying to bundle them as JS modules.
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
  build: {
    target: 'esnext',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
      },
    },
  },
  // Exclude @huggingface/transformers from Vite pre-bundling — it manages
  // its own ONNX Runtime Web workers and WASM paths internally.
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    headers: {
      // Required for SharedArrayBuffer (WASM threads) in dev server
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});


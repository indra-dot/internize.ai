import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

const isExtensionBuild = process.env.BUILD_TARGET === 'extension';

export default defineConfig({
  plugins: [
    react(),
    ...(isExtensionBuild ? [crx({ manifest })] : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
  build: {
    target: 'esnext',
    emptyOutDir: true,
    outDir: isExtensionBuild ? 'dist-extension' : 'dist',
    rollupOptions: {
      input: isExtensionBuild
        ? { sidepanel: resolve(__dirname, 'sidepanel.html') }
        : { main: resolve(__dirname, 'index.html') },
    },
  },
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
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});

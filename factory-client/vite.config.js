import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      'react-bootstrap': fileURLToPath(new URL('./src/vendor/reactBootstrap.jsx', import.meta.url)),
      'react-toastify': fileURLToPath(new URL('./src/vendor/reactToastify.js', import.meta.url)),
      'react-icons/fa': fileURLToPath(new URL('./src/vendor/reactIconsFa.jsx', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  build: {
    outDir: 'build',
  },
});

import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});

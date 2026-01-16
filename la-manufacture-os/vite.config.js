import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        atelier: resolve(__dirname, 'atelier.html'),
        team: resolve(__dirname, 'team.html'),
      },
      output: {
        manualChunks: {
          'clerk': ['@clerk/clerk-js'],
          'date-utils': ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: { 
    outDir: 'build', 
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'pixi-core': ['pixi.js'],
          'gsap-vendor': ['gsap'],
          'howler': ['howler'],
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});

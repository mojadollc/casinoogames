import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: { outDir: 'build', sourcemap: false },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});

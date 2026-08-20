import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      // Se mide lo que tiene logica; las paginas se prueban por comportamiento,
      // no por porcentaje.
      include: ['src/utils/**', 'src/hooks/**', 'src/api/**', 'src/components/**'],
    },
  },
});

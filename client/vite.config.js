import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En desarrollo el front llama a /api y Vite lo reenvia al backend:
    // asi no hay CORS ni hace falta VITE_API_URL en local.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Separa las libs pesadas para que el bundle inicial no cargue mapa ni
        // graficas. Rolldown (el bundler de Vite 8) solo acepta manualChunks
        // como funcion, ya no como objeto {chunk: [paquetes]}.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(leaflet|react-leaflet)\//.test(id)) return 'maps';
          if (/node_modules\/recharts\//.test(id)) return 'charts';
          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(id)) return 'vendor';
          return undefined;
        },
      },
    },
  },
});

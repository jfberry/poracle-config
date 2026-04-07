import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set PORACLE_URL to your PoracleNG instance to proxy API calls (avoids CORS issues)
// Example: PORACLE_URL=http://localhost:4200 npm run dev
const poracleUrl = process.env.PORACLE_URL || 'http://localhost:3030';

export default defineConfig({
  plugins: [react()],
  base: '/poracle-config/',
  server: {
    port: 3000,
    proxy: {
      '/poracle-api': {
        target: poracleUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/poracle-api/, ''),
      },
    },
  },
});

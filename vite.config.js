import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Set PORACLE_URL to your PoracleNG instance to proxy API calls (avoids CORS issues)
// Example: PORACLE_URL=http://localhost:4200 npm run dev
const poracleUrl = process.env.PORACLE_URL || 'http://localhost:3030';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
let gitSha = '';
try {
  gitSha = execSync('git rev-parse --short HEAD').toString().trim();
} catch {
  // Not a git checkout, leave empty
}

export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/poracle-config/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(gitSha),
  },
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

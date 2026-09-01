import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Mirrors the production reverse proxy, which forwards /api/* to the backend and strips
    // the prefix — the backend's own routes have no api/ prefix (see Program.cs controllers).
    proxy: {
      '/api': {
        target: 'http://localhost:5297',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

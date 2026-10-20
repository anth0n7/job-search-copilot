import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true → listen on 0.0.0.0 so the Vite server is reachable from
  // outside the Docker container (same idea as the Express bind on the API).
  server: {
    host: true,
    port: 5173,
  },
  optimizeDeps: {
    include: ['react-router'],
  },
})

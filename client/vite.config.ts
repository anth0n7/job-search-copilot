import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps:{
    include: ['react-router'],
  },
  // Test runner settings: jsdom is a pretend browser so React hooks can run in tests
  test: {
    environment: 'jsdom',
    // a non-UTC zone on purpose so time-zone bugs show up in tests
    env: { TZ: 'America/New_York' },
  },
})

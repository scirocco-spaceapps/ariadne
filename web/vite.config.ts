/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Ports: see root CLAUDE.md. planner 8001, mission-control 8002.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/planner': {
        target: 'http://localhost:8001',
        rewrite: (p) => p.replace(/^\/api\/planner/, ''),
      },
      '/api/mc': {
        target: 'http://localhost:8002',
        rewrite: (p) => p.replace(/^\/api\/mc/, ''),
      },
      '/ws': { target: 'ws://localhost:8002', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
})

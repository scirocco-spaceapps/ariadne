/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// Ports: see root CLAUDE.md. planner 8000, mission-control 8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The app bundles contracts/aoi.json and, for DEMO mode, contracts/fixtures/.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../contracts'] },
    proxy: {
      '/api/planner': {
        target: 'http://localhost:8000',
        rewrite: (p) => p.replace(/^\/api\/planner/, ''),
      },
      '/api/mc': {
        target: 'http://localhost:8080',
        rewrite: (p) => p.replace(/^\/api\/mc/, ''),
      },
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
})

/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://shaauryaa.github.io/epsilon-nfa-to-dfa-simulator/
  base: '/epsilon-nfa-to-dfa-simulator/',
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Split the libraries out of the app chunk so no chunk passes 500 kB; jsPDF and the
        // report code are already loaded on demand (dynamic import in exports.ts / report.ts).
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'reactflow', test: /node_modules[\\/](reactflow|@reactflow|d3-[a-z-]+|zustand|classcat|use-sync-external-store)[\\/]/ },
            { name: 'dagre', test: /node_modules[\\/](dagre|graphlib|lodash)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/presets/**/*.ts'],
      reporter: ['text-summary', 'text', 'html'],
    },
  },
})

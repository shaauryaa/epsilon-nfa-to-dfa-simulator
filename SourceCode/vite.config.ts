/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://shaauryaa.github.io/epsilon-nfa-to-dfa-simulator/
  base: '/epsilon-nfa-to-dfa-simulator/',
  plugins: [react(), tailwindcss()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
  },
})

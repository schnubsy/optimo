import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Build id stamped into <meta name="build"> — the ship-proof fingerprint (docs/spec.md §8).
function buildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

function buildMeta(): Plugin {
  const id = buildId()
  return {
    name: 'optimo-build-meta',
    transformIndexHtml: (html) => html.replace('%BUILD%', id),
  }
}

export default defineConfig({
  base: '/optimo/',
  plugins: [react(), buildMeta()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
  },
})

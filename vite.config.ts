import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    react(),
    buildMeta(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // src/sw-register.ts registers after first paint
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/optimo/',
        name: 'optimo — day planner',
        short_name: 'optimo',
        description: 'One timeline for the day, an inbox for everything else, built by dragging blocks into place.',
        start_url: '/optimo/',
        scope: '/optimo/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#212427',
        theme_color: '#212427',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/optimo/index.html',
        cleanupOutdatedCaches: true,
        // Supabase traffic is never cached by the SW: the outbox owns offline writes.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup.ts'],
    // a DST-observing zone so the floating-time recurrence tests are meaningful on any machine
    env: { TZ: 'America/New_York' },
  },
})

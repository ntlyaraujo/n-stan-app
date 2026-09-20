import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  /**
   * Served from the root of its own host (#27). `src/App.tsx` reads this back as
   * the router's `basename`, so moving the app under a subpath is this one line
   * and nothing else.
   */
  base: '/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    /**
     * Installable to the home screen, with the shell available offline (#45).
     *
     * The service worker caches **the app shell and nothing else**. There is
     * deliberately no `runtimeCaching` rule: Dictionary responses are cached in
     * IndexedDB by `src/dictionary/cachedLookup.ts` (spec 7), and a second cache
     * in front of the same requests would mean two places to reason about when a
     * Lookup returns something stale or wrong.
     *
     * Everything the app holds is already local, so offline is only ever a
     * question of whether the shell loads. Once it has, capture, writing and
     * every word already looked up work with no network at all.
     */
    VitePWA({
      // Writing is why this app exists; a stale shell is not worth a prompt.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'n-stan-app',
        short_name: 'n-stan',
        description:
          'A private notebook for learning Swedish: vocabulary with full paradigms, grammar notes, and a writing journal. Everything stays in your own browser.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // `--surface` in both themes. The tag in `index.html` overrides the
        // light value at runtime when the theme control asks for dark (#46).
        theme_color: '#f9fafd',
        background_color: '#f9fafd',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The same catch-all the host serves (#27), so a deep link opened from
        // the home screen resolves even with no network.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    // Data layer only: storage, API response mapping, linking logic.
    // Component tests are deliberately out of scope (spec section 7).
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // An in-memory IndexedDB, so the storage tests run against the real API
    // surface — transactions, indexes and upgrades included — under node.
    setupFiles: ['fake-indexeddb/auto'],
  },
})

import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  test: {
    // Data layer only: storage, API response mapping, linking logic.
    // Component tests are deliberately out of scope (spec section 7).
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

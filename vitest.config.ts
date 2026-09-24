import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@renderer': resolve(__dirname, 'src/renderer/src'),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'tests/unit/shared/**/*.test.ts',
            'tests/unit/main/**/*.test.ts',
            'tests/unit/preload/**/*.test.ts',
          ],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['src/renderer/src/test/setup.ts'],
          include: ['tests/unit/renderer/src/**/*.test.{ts,tsx}'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/renderer/src/test/**',
        // Reine Electron-Glue (App-Lifecycle, Renderer-Bootstrap) – per Playwright-E2E abgedeckt
        'src/main/index.ts',
        'src/renderer/src/main.tsx',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
})

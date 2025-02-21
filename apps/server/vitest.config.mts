import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup/vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**/*'],
    },
  },
  resolve: {
    alias: {
      lib: resolve(__dirname, './src/lib'),
      middleware: resolve(__dirname, './src/middleware'),
      routes: resolve(__dirname, './src/routes'),
      types: resolve(__dirname, './src/types'),
      db: resolve(__dirname, './src/db'),
      graphql: resolve(__dirname, './src/graphql'),
    },
  },
})

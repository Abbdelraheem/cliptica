import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx,mts,mjs}'],
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXTAUTH_SECRET: 'test-secret-for-unit-tests',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})

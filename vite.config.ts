import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: 'logic', environment: 'node', include: ['src/state/**/*.test.ts'] } },
      { extends: true, test: { name: 'hooks', environment: 'happy-dom', include: ['src/hooks/**/*.test.ts'] } },
    ],
  },
})

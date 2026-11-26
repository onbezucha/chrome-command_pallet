import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.ts'

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/commandbar/popup.html',
        options: 'src/options/index.html',
      },
    },
  },
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})

import { defineConfig } from '@playwright/test';

// e2e на прод-сборке с локальной синхронизацией (?db=local): две вкладки одного браузера
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: { baseURL: 'http://localhost:4173/', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'npm run build && npx vite preview --port 4173 --strictPort', url: 'http://localhost:4173/', timeout: 180_000, reuseExistingServer: true },
});

import { defineConfig } from '@playwright/test';

// Живой сайт и настоящий Firebase: npm run e2e:live (LIVE_URL переопределяет адрес)
export default defineConfig({
  testDir: 'e2e-live',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  use: { baseURL: process.env.LIVE_URL ?? 'https://fliegerfaust.github.io/coderoom/', viewport: { width: 1440, height: 900 } },
});

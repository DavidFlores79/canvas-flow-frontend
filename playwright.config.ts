import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  globalSetup: path.join(__dirname, 'e2e/global-setup.ts'),
  use: {
    baseURL: 'http://localhost:4200',
    storageState: path.join(__dirname, 'e2e/.auth.json'),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

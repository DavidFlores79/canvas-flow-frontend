import { chromium } from '@playwright/test';
import path from 'path';

export default async function globalSetup() {
  const email = process.env['E2E_EMAIL'] ?? '';
  const password = process.env['E2E_PASSWORD'] ?? '';

  if (!email || !password) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD environment variables before running e2e tests.');
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4200/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in|log in|ingresar|iniciar/i }).click();
  await page.waitForURL(/dashboard|editor/, { timeout: 15000 });
  await page.context().storageState({ path: path.join(__dirname, '.auth.json') });
  await browser.close();
}

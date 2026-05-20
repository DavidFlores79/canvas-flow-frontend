import { test, expect, Page } from '@playwright/test';

async function openEditor(page: Page) {
  await page.goto('/dashboard');
  await page.waitForSelector('app-workspace-card', { timeout: 10000 });
  await page.locator('app-workspace-card').first().click();
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.getByRole('button', { name: /fit to space/i }).click().catch(() => {});
  await page.waitForTimeout(800);
}

async function addLayer(page: Page, tool: 'Text' | 'Shape', x: number, y: number) {
  await page.getByRole('button', { name: tool }).click();
  await page.locator('canvas').first().click({ position: { x, y }, force: true });
  await page.waitForTimeout(300);
}

test.describe('Canvas: Delete with keyboard', () => {
  test('Delete key removes the selected layer', async ({ page }) => {
    await openEditor(page);
    await addLayer(page, 'Shape', 80, 80);

    await page.getByRole('button', { name: 'Select' }).click();
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 80, y: 80 }, force: true });
    await page.waitForTimeout(150);
    await expect(page.locator('text=shape —').first()).toBeVisible();

    await canvas.focus();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(400);

    await expect(page.locator('text=No layers yet')).toBeVisible();
  });

  test('Backspace key removes the selected layer', async ({ page }) => {
    await openEditor(page);
    await addLayer(page, 'Shape', 80, 80);

    await page.getByRole('button', { name: 'Select' }).click();
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 80, y: 80 }, force: true });
    await page.waitForTimeout(150);
    await expect(page.locator('text=shape —').first()).toBeVisible();

    await canvas.focus();
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(400);

    await expect(page.locator('text=No layers yet')).toBeVisible();
  });
});

test.describe('Canvas: Multi-select more than 2 objects', () => {
  test('Drag-select selects all 3 shapes', async ({ page }) => {
    await openEditor(page);
    await addLayer(page, 'Shape', 20, 20);
    await addLayer(page, 'Shape', 170, 20);
    await addLayer(page, 'Shape', 20, 80);

    await page.getByRole('button', { name: 'Select' }).click();
    const canvas = page.locator('canvas').first();
    await canvas.dragTo(canvas, {
      sourcePosition: { x: 5, y: 5 },
      targetPosition: { x: 315, y: 235 },
      force: true,
    });
    await page.waitForTimeout(400);

    await expect(page.locator('text=shape —')).toHaveCount(3);
  });

  test('Shift-click selects 3 shapes', async ({ page }) => {
    await openEditor(page);
    await addLayer(page, 'Shape', 20, 20);
    await addLayer(page, 'Shape', 170, 20);
    await addLayer(page, 'Shape', 20, 80);

    await page.getByRole('button', { name: 'Select' }).click();
    const canvas = page.locator('canvas').first();

    await canvas.click({ position: { x: 95, y: 95 }, force: true });
    await page.waitForTimeout(100);
    await canvas.click({ position: { x: 245, y: 95 }, modifiers: ['Shift'], force: true });
    await page.waitForTimeout(100);
    await canvas.click({ position: { x: 95, y: 155 }, modifiers: ['Shift'], force: true });
    await page.waitForTimeout(400);

    await expect(page.locator('text=shape —')).toHaveCount(3);
  });
});

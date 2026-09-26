// optimo smoke spec — runs on desktop AND iPhone 15 (see playwright.config.ts).
// Slice 1 makes this pass against the empty shell; later slices extend it (never replace it).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('optimo smoke', () => {
  test('loads the shell with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('./');
    await expect(page).toHaveTitle(/optimo/i);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('meta[name="build"]')).toHaveCount(1);

    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('has no serious/critical accessibility violations', async ({ page }) => {
    await page.goto('./');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});

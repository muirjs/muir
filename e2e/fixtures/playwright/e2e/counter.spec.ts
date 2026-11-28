import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('counts a click', async ({ page }) => {
  await page.getByRole('button', { name: 'Add' }).click();

  await expect(page.getByRole('status')).toHaveText('1');
});

test('says many after three clicks', async ({ page }) => {
  const add = page.getByRole('button', { name: 'Add' });

  await add.click();
  await add.click();
  await add.click();

  await expect(page.getByRole('status')).toHaveText('many');
});

import { expect, test, type Page } from '@playwright/test';

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function fillValidForm(page: Page, city = 'Goa') {
  await page.getByLabel('City').fill(city);
  await page.getByLabel('Check-in').fill(futureDate(1));
  await page.getByLabel('Check-out').fill(futureDate(3));
}

async function selectScenario(page: Page, label: string) {
  await page.getByLabel('Dev: force supplier scenario').selectOption({ label });
}

test('happy search: form -> spinner -> result card shows name, price, supplier badge', async ({ page }) => {
  await page.goto('/');
  await selectScenario(page, 'A cheaper');
  await fillValidForm(page, 'PlaywrightHappyPath');
  await page.getByRole('button', { name: /search hotels/i }).click();

  await expect(page.getByTestId('loading-state')).toBeVisible();
  const card = page.getByTestId('result-card');
  await expect(card).toBeVisible({ timeout: 15000 });
  await expect(card).toContainText('Supplier A');
  await expect(card.locator('.price')).not.toBeEmpty();
});

test('validation: check-out before check-in shows an inline error and makes no network call', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('City').fill('Goa');
  await page.getByLabel('Check-in').fill(futureDate(3));
  await page.getByLabel('Check-out').fill(futureDate(1));

  let requestMade = false;
  page.on('request', (req) => {
    if (req.url().includes('/api/search-hotels')) requestMade = true;
  });

  await page.getByRole('button', { name: /search hotels/i }).click();

  await expect(page.getByText('Check-out must be after check-in')).toBeVisible();
  expect(requestMade).toBe(false);
});

test('both suppliers fail: red error banner with a working retry button', async ({ page }) => {
  await page.goto('/');
  await selectScenario(page, 'Both fail');
  await fillValidForm(page, 'PlaywrightBothFail');
  await page.getByRole('button', { name: /search hotels/i }).click();

  const banner = page.getByTestId('error-banner');
  await expect(banner).toBeVisible({ timeout: 15000 });
  await expect(banner).toContainText('unavailable');

  await page.getByRole('button', { name: /retry/i }).click();
  await expect(page.getByTestId('loading-state')).toBeVisible();
});

test('no hotels: neutral empty state, not an error style', async ({ page }) => {
  await page.goto('/');
  await selectScenario(page, 'Both empty');
  await fillValidForm(page, 'PlaywrightBothEmpty');
  await page.getByRole('button', { name: /search hotels/i }).click();

  await expect(page.getByTestId('empty-state')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('error-banner')).toHaveCount(0);
});

test('cancel mid-search: Cancel returns the UI to an idle-like state', async ({ page }) => {
  await page.goto('/');
  await selectScenario(page, 'A slow (>5s)');
  await fillValidForm(page, 'PlaywrightCancel');
  await page.getByRole('button', { name: /search hotels/i }).click();

  await expect(page.getByTestId('loading-state')).toBeVisible();
  await page.getByRole('button', { name: /cancel/i }).click();

  await expect(page.getByTestId('cancelled-note')).toBeVisible();
});

import { expect, test } from '@playwright/test';

/**
 * Issue #163 - Credit Cards: Account kinds + card CRUD in Settings.
 *
 * Runs against a dev server at localhost:4200 (same contract as the other
 * specs in this folder). Each test starts from a fresh context, so IndexedDB
 * carries no state between them.
 */

test.use({ baseURL: 'http://localhost:4200' });

function section(page: import('@playwright/test').Page, heading: string) {
  return page.locator('section.card').filter({
    has: page.getByRole('heading', { name: heading }),
  });
}

function cardRow(page: import('@playwright/test').Page, name: string) {
  return section(page, 'Credit Cards')
    .locator('.account-row')
    .filter({ hasText: name });
}

async function completeOnboarding(page: import('@playwright/test').Page) {
  await page.goto('/onboarding');

  // 1. Language
  await page.getByRole('button', { name: 'Continue' }).click();

  // 2. Restore: start fresh
  await page.getByRole('button', { name: 'Start fresh' }).click();

  // 3. Currency: EUR is preselected
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. Accounts: one Cash Account
  await page.getByRole('button', { name: 'New account' }).click();
  await page.getByLabel('Account name').fill('Checking');
  await page.getByLabel('Initial balance').fill('100');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Categories: defaults are fine
  await page.getByRole('button', { name: 'Start Tracking' }).click();
  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

test.describe('Settings credit cards (#163)', () => {
  test('creates a card with a starting debt, limit and payment category', async ({ page }) => {
    await completeOnboarding(page);
    await page.goto('/settings');

    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();

    const form = cards.locator('.inline-form');
    await form.getByLabel('Name').fill('Visa');
    await form.getByLabel('Starting debt').fill('-500');
    await form.getByLabel('Limit').fill('2000');
    await form.getByRole('button', { name: '+ Add Card' }).click();

    const row = cardRow(page, 'Visa');
    await expect(row).toBeVisible();
    await expect(row).toContainText('EUR');
    await expect(row).toContainText('Checking');
    await expect(row).toContainText('-500');
    await expect(row).toContainText('2000');

    // The consent checkbox also created the card's payment category.
    await expect(section(page, 'Categories')).toContainText('Visa payment');

    // The card lives in its own section, not among the Accounts.
    await expect(
      section(page, 'Accounts').locator('.account-row').filter({ hasText: 'Visa' }),
    ).toHaveCount(0);
  });

  test('creates no payment category when consent is declined', async ({ page }) => {
    await completeOnboarding(page);
    await page.goto('/settings');

    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const form = cards.locator('.inline-form');
    await form.getByLabel('Name').fill('Visa');
    await form.getByRole('checkbox').uncheck();
    await form.getByRole('button', { name: '+ Add Card' }).click();

    await expect(cardRow(page, 'Visa')).toBeVisible();
    await expect(section(page, 'Categories')).not.toContainText('Visa payment');
  });

  test('edits a card name, starting debt and limit', async ({ page }) => {
    await completeOnboarding(page);
    await page.goto('/settings');

    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const form = cards.locator('.inline-form');
    await form.getByLabel('Name').fill('Visa');
    await form.getByLabel('Starting debt').fill('-500');
    await form.getByRole('button', { name: '+ Add Card' }).click();

    const row = cardRow(page, 'Visa');
    await row.getByRole('button', { name: 'Edit card' }).click();

    const edit = cards.locator('.edit-state');
    await edit.getByLabel('Name').fill('Mastercard');
    await edit.getByLabel('Starting debt').fill('-750');
    await edit.getByLabel('Limit').fill('3000');
    await edit.getByRole('button', { name: 'Save changes' }).click();

    await expect(cardRow(page, 'Mastercard')).toBeVisible();
    await expect(cardRow(page, 'Mastercard')).toContainText('-750');
    await expect(cardRow(page, 'Mastercard')).toContainText('3000');
  });

  test('deletes an unused card after the inline confirm', async ({ page }) => {
    await completeOnboarding(page);
    await page.goto('/settings');

    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const form = cards.locator('.inline-form');
    await form.getByLabel('Name').fill('Visa');
    await form.getByRole('button', { name: '+ Add Card' }).click();

    const row = cardRow(page, 'Visa');
    await row.getByRole('button', { name: 'Delete card' }).click();
    await expect(row.getByRole('button', { name: 'Confirm deletion' })).toBeVisible();
    await row.getByRole('button', { name: 'Confirm deletion' }).click();

    await expect(cardRow(page, 'Visa')).toHaveCount(0);
  });

  test('refuses to delete a linked account and offers Deactivation instead', async ({ page }) => {
    await completeOnboarding(page);
    await page.goto('/settings');

    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const form = cards.locator('.inline-form');
    await form.getByLabel('Name').fill('Visa');
    await form.getByRole('button', { name: '+ Add Card' }).click();
    await expect(cardRow(page, 'Visa')).toBeVisible();

    const accounts = section(page, 'Accounts');
    const checking = accounts.locator('.account-row').filter({ hasText: 'Checking' });
    await checking.getByRole('button', { name: 'Delete account' }).click();

    const refusal = checking.locator('.delete-refusal');
    await expect(refusal).toBeVisible();
    await expect(refusal).toContainText('linked to a credit card');
    await refusal.getByRole('button', { name: 'Deactivate instead' }).click();

    await expect(checking).toContainText('Inactive');
  });
});

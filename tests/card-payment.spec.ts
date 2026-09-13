import { expect, test } from '@playwright/test';

/**
 * Issue #165 - Card payments: Transfer Form payment mode + cash-basis expenses.
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

test.describe('Card payments count as expenses (#165)', () => {
  test('pays a statement and sees Expenses rise in the payment Period', async ({ page }) => {
    await completeOnboarding(page);

    // A card whose payment category is created on consent.
    await page.goto('/settings');
    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const cardForm = cards.locator('.inline-form');
    await cardForm.getByLabel('Name').fill('Visa');
    await cardForm.getByRole('button', { name: '+ Add Card' }).click();
    await expect(cards.locator('.account-row').filter({ hasText: 'Visa' })).toBeVisible();

    // Baseline cash expense, so the KPI ledger shows real figures.
    await page.goto('/movements');
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const cashForm = page.locator('app-transaction-form');
    await cashForm.getByLabel('Amount').fill('100');
    await cashForm.getByRole('button', { name: 'Save' }).click();
    await expect(cashForm).toHaveCount(0);

    // A card purchase: moves the card's debt but never the cash-basis Expenses.
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const purchaseForm = page.locator('app-transaction-form');
    await purchaseForm.getByLabel('Account').selectOption({ label: 'Visa (EUR)' });
    await purchaseForm.getByLabel('Amount').fill('500');
    await purchaseForm.getByRole('button', { name: 'Save' }).click();
    await expect(purchaseForm).toHaveCount(0);

    await page.goto('/stats');
    const expenses = page.locator('.kpi-line.kpi-expense .value');
    await expect(expenses).toContainText('100.00');

    // The Card Payment: the Transfer Form becomes the payment capture.
    await page.goto('/movements');
    await page.getByRole('button', { name: '+ Transfer' }).click();
    const transferForm = page.locator('app-transfer-form');
    await transferForm.getByLabel('From').selectOption({ label: 'Checking' });
    await transferForm.getByLabel('To').selectOption({ label: 'Visa' });

    await expect(transferForm.locator('.card-balance-hint')).toContainText('Outstanding balance');
    const category = transferForm.getByLabel('Payment category');
    await expect(category).toBeVisible();
    await expect(category).toHaveValue(/.+/);

    await transferForm.getByLabel('Amount (EUR)').fill('500');
    await transferForm.getByRole('button', { name: 'Save' }).click();
    await expect(transferForm).toHaveCount(0);

    // The payment reaches Expenses in its Period.
    await page.goto('/stats');
    await expect(expenses).toContainText('600.00');
  });
});

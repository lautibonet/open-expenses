import { expect, test } from '@playwright/test';

/**
 * Issue #164 - Card purchases: Transaction Form + cash-basis KPI totals.
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

test.describe('Card purchases exclude the cash-basis KPIs (#164)', () => {
  test('records a card purchase and leaves the Expenses KPI unchanged', async ({ page }) => {
    await completeOnboarding(page);

    // A card for the purchase to land on.
    await page.goto('/settings');
    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const cardForm = cards.locator('.inline-form');
    await cardForm.getByLabel('Name').fill('Visa');
    await cardForm.getByRole('button', { name: '+ Add Card' }).click();
    await expect(cards.locator('.account-row').filter({ hasText: 'Visa' })).toBeVisible();

    // Baseline: one cash expense, so the KPI card shows real figures.
    await page.goto('/movements');
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const cashForm = page.locator('app-transaction-form');
    await cashForm.getByLabel('Amount').fill('100');
    await cashForm.getByRole('button', { name: 'Save' }).click();
    await expect(cashForm).toHaveCount(0);

    await page.goto('/stats');
    const expenses = page.locator('.kpi-line.kpi-expense .value');
    const before = await expenses.textContent();
    expect(before?.trim()).not.toBe('');

    // The purchase: recorded on the card, with the hint on display.
    await page.goto('/movements');
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const form = page.locator('app-transaction-form');
    await form.getByLabel('Account').selectOption({ label: 'Visa (EUR)' });
    await expect(form.locator('.card-hint')).toContainText('counted when the Statement is paid');
    await form.getByLabel('Amount').fill('500');
    await form.getByRole('button', { name: 'Save' }).click();
    await expect(form).toHaveCount(0);

    // The cash-basis Expenses KPI does not move; the card balance does.
    await page.goto('/stats');
    await expect(expenses).toHaveText(before!.trim());

    const cardRow = section(page, 'Account Balances')
      .locator('.balance-row')
      .filter({ hasText: 'Visa' });
    await expect(cardRow).toHaveClass(/negative/);
    await expect(cardRow.locator('.balance-amount')).toContainText('-');
  });
});

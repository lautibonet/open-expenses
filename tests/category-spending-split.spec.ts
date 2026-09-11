import { expect, test } from '@playwright/test';

/**
 * Issue #167 - Spending by Category: cash/credit two-tone bars.
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

test.describe('Spending by Category is split cash/credit (#167)', () => {
  test('renders a card purchase as a credit-colored segment', async ({ page }) => {
    await completeOnboarding(page);

    // A card for the purchase to land on.
    await page.goto('/settings');
    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const cardForm = cards.locator('.inline-form');
    await cardForm.getByLabel('Name').fill('Visa');
    await cardForm.getByRole('button', { name: '+ Add Card' }).click();
    await expect(cards.locator('.account-row').filter({ hasText: 'Visa' })).toBeVisible();

    // Cash spending in Food, so the same category bar carries both tones.
    await page.goto('/movements');
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const cashForm = page.locator('app-transaction-form');
    await cashForm.getByLabel('Category').selectOption({ label: 'Food (Expense)' });
    await cashForm.getByLabel('Amount').fill('100');
    await cashForm.getByRole('button', { name: 'Save' }).click();
    await expect(cashForm).toHaveCount(0);

    // Card spending in the same category: the credit tone.
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const cardForm2 = page.locator('app-transaction-form');
    await cardForm2.getByLabel('Account').selectOption({ label: 'Visa (EUR)' });
    await cardForm2.getByLabel('Category').selectOption({ label: 'Food (Expense)' });
    await cardForm2.getByLabel('Amount').fill('300');
    await cardForm2.getByRole('button', { name: 'Save' }).click();
    await expect(cardForm2).toHaveCount(0);

    await page.goto('/stats');
    const spending = section(page, 'Spending by Category');
    await expect(spending.getByRole('heading', { name: /Spending by Category/ })).toBeVisible();

    const cash = spending.locator('.category-bar-row .bar-segment.cash').first();
    const credit = spending.locator('.category-bar-row .bar-segment.credit').first();
    await expect(cash).toBeVisible();
    await expect(credit).toBeVisible();

    const creditBackdrop = await credit.evaluate(el => getComputedStyle(el).backgroundImage);
    expect(creditBackdrop).toContain('repeating-linear-gradient');

    // The amount headline still reports the full spending: 100 + 300.
    await expect(spending.locator('.cat-amount').first()).toContainText('400.00');
  });
});

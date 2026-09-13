import { expect, test } from '@playwright/test';

/**
 * Issue #168 - Movements list treatment for card movements + full journey E2E.
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
  await page.getByLabel('Initial balance').fill('1000');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Categories: defaults are fine
  await page.getByRole('button', { name: 'Start Tracking' }).click();
  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

test.describe('Credit card full journey (#168)', () => {
  test('creates a card, records a purchase, pays the statement, and Stats reflects it', async ({
    page,
  }) => {
    await completeOnboarding(page);

    // 1. Create the card (with its payment category) in Settings.
    await page.goto('/settings');
    const cards = section(page, 'Credit Cards');
    await cards.getByRole('button', { name: 'New card' }).click();
    const cardForm = cards.locator('.inline-form');
    await cardForm.getByLabel('Name').fill('Visa');
    await cardForm.getByRole('button', { name: '+ Add Card' }).click();
    await expect(cards.locator('.account-row').filter({ hasText: 'Visa' })).toBeVisible();

    // 2. A baseline cash expense, so the KPI ledger shows real figures.
    await page.goto('/movements');
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const cashForm = page.locator('app-transaction-form');
    await cashForm.getByLabel('Category').selectOption({ label: 'Food (Expense)' });
    await cashForm.getByLabel('Amount').fill('100');
    await cashForm.getByRole('button', { name: 'Save' }).click();
    await expect(cashForm).toHaveCount(0);

    // 3. The card purchase: the row wears the Card badge beside its category.
    await page.getByRole('button', { name: '+ Transaction' }).click();
    const purchaseForm = page.locator('app-transaction-form');
    await purchaseForm.getByLabel('Account').selectOption({ label: 'Visa (EUR)' });
    await expect(purchaseForm.locator('.card-hint')).toContainText(
      'counted when the Statement is paid',
    );
    await purchaseForm.getByLabel('Category').selectOption({ label: 'Food (Expense)' });
    await purchaseForm.getByLabel('Amount').fill('300');
    await purchaseForm.getByRole('button', { name: 'Save' }).click();
    await expect(purchaseForm).toHaveCount(0);

    const purchaseRow = page.locator('tr.row-expense').filter({
      has: page.locator('.card-badge'),
    });
    await expect(purchaseRow).toHaveCount(1);
    await expect(purchaseRow.locator('.cat-chip')).toHaveText('Food');
    await expect(purchaseRow.locator('.card-badge')).toHaveText('Card');

    // 4. The purchase moves the card's debt but never the cash-basis Expenses.
    await page.goto('/stats');
    const expenses = page.locator('.kpi-line.kpi-expense .value');
    await expect(expenses).toContainText('100.00');

    const cardBalance = section(page, 'Account Balances')
      .locator('.balance-row')
      .filter({ hasText: 'Visa' });
    await expect(cardBalance).toHaveClass(/negative/);
    await expect(cardBalance.locator('.balance-amount')).toContainText('€300.00');

    const totalBalance = page.locator('.total-balance-card');
    await expect(totalBalance.locator('.balance-line.debt .value')).toContainText('€300.00');

    // 5. Pay the statement: the Transfer Form becomes the Card Payment capture.
    await page.goto('/movements');
    await page.getByRole('button', { name: '+ Transfer' }).click();
    const paymentForm = page.locator('app-transfer-form');
    await paymentForm.getByLabel('From').selectOption({ label: 'Checking' });
    await paymentForm.getByLabel('To').selectOption({ label: 'Visa' });
    await expect(paymentForm.locator('.card-balance-hint')).toContainText('Outstanding balance');
    await expect(paymentForm.getByLabel('Payment category')).toHaveValue(/.+/);
    await paymentForm.getByLabel('Amount (EUR)').fill('300');
    await paymentForm.getByRole('button', { name: 'Save' }).click();
    await expect(paymentForm).toHaveCount(0);

    // 6. The Card Payment row shows its category, the way a Transaction does.
    const paymentRow = page
      .locator('tr.transfer-row')
      .filter({ hasText: 'Visa payment' });
    await expect(paymentRow.locator('.cat-chip')).toHaveText('Visa payment');
    await expect(paymentRow.locator('.route')).toContainText('Checking');

    // 7. Stats reflects everything: Expenses rose, the debt is settled.
    await page.goto('/stats');
    await expect(expenses).toContainText('400.00');
    await expect(cardBalance).not.toHaveClass(/negative/);
    await expect(cardBalance.locator('.balance-amount')).toContainText('€0.00');
    await expect(totalBalance.locator('.balance-line.debt')).toHaveCount(0);
    await expect(totalBalance.locator('.stat .value')).toContainText('€600.00');
  });
});

import { expect, test } from '@playwright/test';

/**
 * Issue #100 — Movements mobile: touch ergonomics & capture-form overflow fix.
 *
 * Coarse-pointer (phone) context: 375×812 with touch enabled so the
 * `(pointer: coarse)` media queries match. Desktop context: 1280×720 mouse,
 * asserting the pre-existing sizing is unchanged.
 */

const LONG_CATEGORY = 'Accommodation And Utilities For Extended Stays Abroad While Traveling';
const LONG_NOTE = 'Split with Alex for the cabin rental, reimburse half next month at settlement';

test.use({ baseURL: 'http://localhost:4200' });
test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

test.describe('movements on a phone (coarse pointer)', () => {
  test('primary action buttons reach the 44px touch minimum', async ({ page }) => {
    await completeOnboarding(page);
    await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();

    const newTransaction = page.getByRole('button', { name: '+ Transaction' });
    const newTransfer = page.getByRole('button', { name: '+ Transfer' });

    await expectHeightAtLeast(newTransaction, 44);
    await expectHeightAtLeast(newTransfer, 44);

    // Capture form buttons too: Quick Add (transaction) Cancel/Save.
    await newTransaction.click();
    const quickAddForm = page.locator('.quick-add-form');
    await expect(quickAddForm).toBeVisible();
    await expectHeightAtLeast(quickAddForm.getByRole('button', { name: 'Cancel' }), 44);
    await expectHeightAtLeast(quickAddForm.getByRole('button', { name: 'Save' }), 44);
    await quickAddForm.getByRole('button', { name: 'Cancel' }).click();

    // Transfer form Cancel/Save.
    await newTransfer.click();
    const transferForm = page.locator('.form-card');
    await expect(transferForm).toBeVisible();
    await expectHeightAtLeast(transferForm.getByRole('button', { name: 'Cancel' }), 44);
    await expectHeightAtLeast(transferForm.getByRole('button', { name: 'Save' }), 44);
  });

  test('resized buttons keep the press interaction (shadow shed on :active)', async ({ page }) => {
    await completeOnboarding(page);

    const button = page.getByRole('button', { name: '+ Transaction' });
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();

    const shadow = await button.evaluate(el => getComputedStyle(el).boxShadow);
    expect(shadow).toBe('none');

    await page.mouse.up();
    const restShadow = await button.evaluate(el => getComputedStyle(el).boxShadow);
    expect(restShadow).not.toBe('none');
  });

  test('keyboard shortcuts legend is hidden', async ({ page }) => {
    await completeOnboarding(page);

    const hint = page.locator('.shortcut-hint');
    await expect(hint).toBeHidden();
  });

  test('Quick Add fits the viewport with the widest category and a long note', async ({ page }) => {
    await completeOnboarding(page, { longCategory: true });

    await page.getByRole('button', { name: '+ Transaction' }).click();
    const form = page.locator('.quick-add-form');
    await expect(form).toBeVisible();

    // Select the widest category and type a long note.
    await form.locator('select[name="category"]').selectOption({ label: `${LONG_CATEGORY} (Expense)` });
    await form.locator('input[name="note"]').fill(LONG_NOTE);

    await expectNoHorizontalOverflow(page);

    // The Save button must be reachable and clickable without scrolling sideways.
    await expect(form.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});

test.describe('movements on desktop (fine pointer)', () => {
  test.describe.configure({ mode: 'serial' });

  test.use({ viewport: { width: 1280, height: 720 }, hasTouch: false });

  test('desktop sizing is unchanged: buttons below 44px, legend visible', async ({ page }) => {
    await completeOnboarding(page);

    const newTransaction = page.getByRole('button', { name: '+ Transaction' });
    await expect(newTransaction).toBeVisible();
    const box = (await newTransaction.boundingBox())!;
    expect(box.height).toBeLessThan(44);

    await expect(page.locator('.shortcut-hint')).toBeVisible();
  });

  test('Quick Add stays two-column on desktop and fits the viewport', async ({ page }) => {
    await completeOnboarding(page, { longCategory: true });

    await page.getByRole('button', { name: '+ Transaction' }).click();
    const form = page.locator('.quick-add-form');
    await expect(form).toBeVisible();

    const gridColumns = await form
      .locator('.form-grid')
      .evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(gridColumns.split(' ').length).toBe(2);

    await expectNoHorizontalOverflow(page);
  });
});

async function expectHeightAtLeast(locator: import('@playwright/test').Locator, min: number) {
  const box = (await locator.boundingBox())!;
  expect(
    box.height,
    `expected button "${await locator.textContent()}" to be at least ${min}px tall`,
  ).toBeGreaterThanOrEqual(min);
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.scrollWidth,
    `document scrollWidth ${overflow.scrollWidth} exceeds viewport ${overflow.innerWidth}`,
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

async function completeOnboarding(
  page: import('@playwright/test').Page,
  opts: { longCategory?: boolean } = {},
) {
  await page.goto('/');

  // 1. Language
  await page.getByRole('button', { name: 'Continue' }).click();

  // 2. Restore: start fresh
  await page.getByRole('button', { name: 'Start fresh' }).click();

  // 3. Currency: EUR is preselected
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. Accounts
  await page.getByPlaceholder('Account name').fill('Checking');
  await page.getByPlaceholder('Initial balance').fill('100');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Categories: defaults are prefilled; optionally rename one to a very long name
  if (opts.longCategory) {
    const miscRow = page.getByRole('row', { name: 'Misc Expense' });
    await miscRow.getByPlaceholder('Category name').fill(LONG_CATEGORY);
  }
  await page.getByRole('button', { name: 'Start Tracking' }).click();

  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

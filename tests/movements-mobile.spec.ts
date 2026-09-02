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

    // Capture form buttons too: New Transaction (transaction form) Cancel/Save.
    await newTransaction.click();
    const transactionForm = page.locator('.transaction-form-form');
    await expect(transactionForm).toBeVisible();
    await expectHeightAtLeast(transactionForm.getByRole('button', { name: 'Cancel' }), 44);
    await expectHeightAtLeast(transactionForm.getByRole('button', { name: 'Save' }), 44);
    await transactionForm.getByRole('button', { name: 'Cancel' }).click();

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

  test('Transaction Form fits the viewport with the widest category and a long note', async ({ page }) => {
    await completeOnboarding(page, { longCategory: true });

    await page.getByRole('button', { name: '+ Transaction' }).click();
    const form = page.locator('.transaction-form-form');
    await expect(form).toBeVisible();

    // Select the widest category and type a long note.
    await form.locator('select[name="category"]').selectOption({ label: `${LONG_CATEGORY} (Expense)` });
    await form.locator('input[name="note"]').fill(LONG_NOTE);

    await expectNoHorizontalOverflow(page);

    // The Save button must be reachable and clickable without scrolling sideways.
    await expect(form.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('first movement row clears the fold without scrolling (#102)', async ({ page }) => {
    await completeOnboarding(page);
    await addTransaction(page, '12.50');

    const row = page.locator('.movement-table tbody tr:not(.day-divider)').first();
    await expect(row).toBeVisible();

    // The fixed bottom nav bar eats the foot of the viewport, so the row
    // must clear viewport minus the nav bar, not just the raw height.
    const navSize = await page.evaluate(
      () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-bar-size')) * 16,
    );
    const box = (await row.boundingBox())!;
    expect(
      box.y + box.height,
      `first movement row bottom (${box.y + box.height}px) must clear the fold above the nav bar (${812 - navSize}px)`,
    ).toBeLessThanOrEqual(812 - navSize);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('page subtitle occupies one line and the scope pair carries a caps label (#102)', async ({
    page,
  }) => {
    await completeOnboarding(page);

    const subtitle = page.locator('.page-header .subtitle');
    const height = await subtitle.evaluate((el) => el.getBoundingClientRect().height);
    // One line of body-lg (1.125rem × 1.6) is 28.8px; two lines would be ~58px.
    expect(height, 'subtitle must render as a single line').toBeLessThanOrEqual(30);

    await expect(page.locator('.scope-control .scope-label')).toHaveText('Scope');
  });

  test('filter card stays collapsed, expands on demand, chips carry active filters (#102)', async ({
    page,
  }) => {
    await completeOnboarding(page);
    await addTransaction(page, '12.50');

    // Collapsed by default: no panel, one search row with the toggle.
    await expect(page.locator('.filter-panel')).toHaveCount(0);
    await expect(page.locator('.filter-bar input[type="search"]')).toBeVisible();
    const toggle = page.locator('.filter-toggle');
    await expect(toggle).toContainText('Filters');

    // Expanding reveals the selects; both show their All… option by default.
    await toggle.click();
    const panel = page.locator('.filter-panel');
    await expect(panel).toBeVisible();
    const selects = panel.locator('select');
    await expect(selects).toHaveCount(2);
    const categoryLabel = await selects
      .nth(0)
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim());
    expect(categoryLabel).toBe('All categories');
    const accountLabel = await selects
      .nth(1)
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim());
    expect(accountLabel).toBe('All accounts');

    // Activate a category filter, collapse: the chip and the badge appear.
    await selects.nth(0).selectOption({ label: 'Misc' });
    await toggle.click();
    await expect(panel).toHaveCount(0);
    const chip = page.locator('.filter-chip');
    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText('Misc');
    const badge = page.locator('.filter-badge');
    await expect(badge).toBeVisible();

    // Badge is outline/neutral, not action blue.
    const badgeStyles = await badge.evaluate((el) => {
      const s = getComputedStyle(el);
      return { background: s.backgroundColor, borderColor: s.borderColor };
    });
    expect(badgeStyles.background).toBe('rgb(255, 255, 255)');
    expect(badgeStyles.background).not.toBe('rgb(0, 62, 199)');

    // Tapping the chip removes that filter.
    await chip.click();
    await expect(page.locator('.filter-chip')).toHaveCount(0);
    await expect(page.locator('.filter-badge')).toHaveCount(0);
  });
});

test.describe('movements capture sheet on a phone (#103)', () => {
  test('bottom nav carries the capture slot as the single blue action', async ({ page }) => {
    await completeOnboarding(page);
    // Park the virtual mouse away from the nav bar: the click that finished
    // onboarding leaves it hovering the page, and :hover deepens the slot.
    await page.mouse.move(0, 200);

    const capture = page.locator('nav.tab-bar button.capture-slot');
    await expect(capture).toBeVisible();
    await expect(capture).toHaveAccessibleName('+ New Transaction');
    await expectHeightAtLeast(capture, 44);

    const styles = await capture.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        borderRadius: s.borderRadius,
        borderWidth: s.borderWidth,
      };
    });
    expect(styles.background).toBe('rgb(0, 82, 255)');
    expect(styles.borderRadius).toBe('0px');
    expect(parseFloat(styles.borderWidth)).toBeGreaterThanOrEqual(1);

    // The slot is the only blue-filled element in the nav bar.
    const blueChildren = await page.locator('nav.tab-bar').evaluate((nav) =>
      Array.from(nav.querySelectorAll('a, button')).filter(
        (el) => getComputedStyle(el).backgroundColor === 'rgb(0, 82, 255)',
      ).length,
    );
    expect(blueChildren).toBe(1);
  });

  test('capture slot opens the sheet; Save/Cancel pinned; save lands in the ledger', async ({
    page,
  }) => {
    await completeOnboarding(page);

    await page.locator('nav.tab-bar button.capture-slot').click();
    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await awaitSheetSettled(page);
    await expect(sheet).toHaveAttribute('role', 'dialog');
    await expect(sheet).toHaveAttribute('aria-modal', 'true');

    // One-column field grid inside the sheet.
    const gridColumns = await sheet
      .locator('.form-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(gridColumns.split(' ').length).toBe(1);

    // Cancel/Save sit pinned at the sheet's bottom edge, reachable without
    // scrolling the form body.
    await expectActionsPinned(sheet);

    await sheet.locator('input[name="amount"]').fill('12.5');
    await sheet.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
    await expect(
      page.locator('.movement-table tbody tr:not(.day-divider)').first(),
    ).toBeVisible();
    await expect(page.locator('.movement-table')).toContainText('12.50');
  });

  test('Cancel dismisses the sheet without saving', async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole('button', { name: '+ Transaction' }).click();
    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await sheet.locator('input[name="amount"]').fill('12.5');
    await sheet.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
    await expect(page.locator('.movement-table tbody tr')).toHaveCount(0);
  });

  test('dragging the handle down dismisses the sheet without saving', async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole('button', { name: '+ Transaction' }).click();
    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await awaitSheetSettled(page);

    const handle = page.locator('.sheet-handle');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
    await expect(page.locator('.movement-table tbody tr')).toHaveCount(0);
  });

  test('editing a transaction opens the same sheet prefilled and saves', async ({ page }) => {
    await completeOnboarding(page);
    await addTransaction(page, '12.50');

    const row = page.locator('.movement-table tbody tr:not(.day-divider)').first();
    await row.getByRole('button', { name: 'Edit movement' }).click();

    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await awaitSheetSettled(page);
    const amount = sheet.locator('input[name="amount"]');
    await expect(amount).toHaveValue('12.5');

    await amount.fill('20');
    await sheet.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
    await expect(page.locator('.movement-table')).toContainText('20.00');
  });
});

test.describe('movements transfer capture sheet on a phone (#104)', () => {
  test('+ Transfer opens the sheet with the form one-column and actions pinned', async ({
    page,
  }) => {
    await completeOnboarding(page, { secondAccount: true });

    await page.getByRole('button', { name: '+ Transfer' }).click();
    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await awaitSheetSettled(page);
    await expect(sheet).toHaveAttribute('role', 'dialog');
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet).toHaveAttribute('aria-label', 'Transfer form');
    await expect(sheet.locator('.form-card')).toBeVisible();

    // Same one-column presentation as the Transaction Form.
    const gridColumns = await sheet
      .locator('.form-grid')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    expect(gridColumns.split(' ').length).toBe(1);

    // Same-currency transfer: no exchange-rate capture appears.
    await expect(sheet.locator('.exchange-rate-section')).toHaveCount(0);

    await expectActionsPinned(sheet);
  });

  test('a same-currency transfer saves from the sheet and lands in the ledger', async ({
    page,
  }) => {
    await completeOnboarding(page, { secondAccount: true });

    await page.getByRole('button', { name: '+ Transfer' }).click();
    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await awaitSheetSettled(page);

    await sheet.locator('.form-card input[type="number"]').first().fill('40');
    await sheet.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
    await expect(
      page.locator('.movement-table tbody tr.transfer-row').first(),
    ).toBeVisible();
    await expect(page.locator('.movement-table')).toContainText('40.00');
  });

  test('editing a transfer opens the sheet prefilled and saves the edit', async ({ page }) => {
    await completeOnboarding(page, { secondAccount: true });
    await addTransfer(page, '40.00');

    const row = page.locator('.movement-table tbody tr.transfer-row').first();
    await row.getByRole('button', { name: 'Edit movement' }).click();

    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await awaitSheetSettled(page);
    await expect(sheet.getByRole('heading')).toContainText('Edit Transfer');

    await sheet.locator('input[name="amount"], input[type="number"]').first().fill('55');
    await sheet.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
    await expect(page.locator('.movement-table')).toContainText('55.00');
  });

  test('dragging the handle down dismisses the transfer sheet without saving', async ({
    page,
  }) => {
    await completeOnboarding(page, { secondAccount: true });

    await page.getByRole('button', { name: '+ Transfer' }).click();
    const sheet = page.locator('app-bottom-sheet .sheet');
    await expect(sheet).toBeVisible();
    await awaitSheetSettled(page);

    const handle = page.locator('.sheet-handle');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, { steps: 5 });
    await page.mouse.up();

    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
    await expect(page.locator('.movement-table tbody tr')).toHaveCount(0);
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

  test('desktop has no capture slot in the sidebar and no sheet on capture', async ({ page }) => {
    await completeOnboarding(page);

    await expect(page.locator('nav.tab-bar button.capture-slot')).toBeHidden();

    await page.getByRole('button', { name: '+ Transaction' }).click();
    await expect(page.locator('.transaction-form-form')).toBeVisible();
    await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
  });

  test('Transaction Form stays two-column on desktop and fits the viewport', async ({ page }) => {
    await completeOnboarding(page, { longCategory: true });

    await page.getByRole('button', { name: '+ Transaction' }).click();
    const form = page.locator('.transaction-form-form');
    await expect(form).toBeVisible();

    const gridColumns = await form
      .locator('.form-grid')
      .evaluate(el => getComputedStyle(el).gridTemplateColumns);
    expect(gridColumns.split(' ').length).toBe(2);

    await expectNoHorizontalOverflow(page);
  });

  test('filter selects show their All… option by default (#102)', async ({ page }) => {
    await completeOnboarding(page);

    await page.locator('.filter-toggle').click();
    const selects = page.locator('.filter-panel select');
    await expect(selects).toHaveCount(2);

    const categoryLabel = await selects
      .nth(0)
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim());
    expect(categoryLabel).toBe('All categories');
    const accountLabel = await selects
      .nth(1)
      .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent?.trim());
    expect(accountLabel).toBe('All accounts');
  });
});

/* The sheet slides up over 0.2s; geometry-sensitive steps (measuring, drag
   starts) must wait until the entrance animation has finished. */
async function awaitSheetSettled(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('app-bottom-sheet .sheet');
      return el !== null && el.getAnimations().length === 0;
    },
    undefined,
    { timeout: 2000 },
  );
}

async function expectHeightAtLeast(locator: import('@playwright/test').Locator, min: number) {
  const box = (await locator.boundingBox())!;
  expect(
    box.height,
    `expected button "${await locator.textContent()}" to be at least ${min}px tall`,
  ).toBeGreaterThanOrEqual(min);
}

async function addTransaction(page: import('@playwright/test').Page, amount: string) {
  await page.getByRole('button', { name: '+ Transaction' }).click();
  const form = page.locator('.transaction-form-form');
  await expect(form).toBeVisible();
  await form.locator('input[name="amount"]').fill(amount);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.transaction-form-form')).toBeHidden();
}

async function addTransfer(page: import('@playwright/test').Page, amount: string) {
  await page.getByRole('button', { name: '+ Transfer' }).click();
  const form = page.locator('.form-card');
  await expect(form).toBeVisible();
  await form.locator('input[type="number"]').first().fill(amount);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('app-bottom-sheet')).toHaveCount(0);
}

/* The sheet slides up over 0.2s; the pinned-action geometry is only honest
   once the entrance animation has finished. */
async function expectActionsPinned(sheet: import('@playwright/test').Locator) {
  const sheetBox = (await sheet.boundingBox())!;
  for (const name of ['Cancel', 'Save']) {
    const box = (await sheet.getByRole('button', { name }).boundingBox())!;
    expect(box.y + box.height, `${name} must sit at the sheet bottom`).toBeGreaterThan(
      sheetBox.y + sheetBox.height - 96,
    );
    expect(box.y + box.height).toBeLessThanOrEqual(sheetBox.y + sheetBox.height);
  }
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
  opts: { longCategory?: boolean; secondAccount?: boolean } = {},
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
  if (opts.secondAccount) {
    await page.getByPlaceholder('Account name').fill('Savings');
    await page.getByPlaceholder('Initial balance').fill('50');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Categories: defaults are prefilled; optionally rename one to a very long name
  if (opts.longCategory) {
    const miscRow = page.getByRole('row', { name: 'Misc Expense' });
    await miscRow.getByPlaceholder('Category name').fill(LONG_CATEGORY);
  }
  await page.getByRole('button', { name: 'Start Tracking' }).click();

  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

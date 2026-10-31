import { expect, test, type Page } from '@playwright/test';

/**
 * Issue #222 / ADR 0030 — the Stats charts cover exactly the Scope.
 *
 * A Scope longer than twelve Periods keeps the twelve-Period track width and
 * scrolls sideways inside its own card, never the page, opening on the To
 * Period. A Scope crossing a year boundary labels each January with its year.
 *
 * Mobile context: 375×812 touch.
 */

test.use({ baseURL: 'http://localhost:4200', viewport: { width: 375, height: 812 }, hasTouch: true });

test('a Scope longer than twelve Periods scrolls inside its card, opening on the To Period', async ({ page }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await completeOnboarding(page);
  await addIncome(page, '1000', `${year - 1}-01-15`);
  await addIncome(page, '3000');

  await page.goto('/stats');
  await page.getByLabel('Scope preset').selectOption({ label: 'Custom' });
  await page.getByLabel('From year').selectOption(String(year - 1));
  await page.getByLabel('From month').selectOption({ label: 'January' });

  /* January of last year through the latest Period: always more than twelve. */
  const periods = 12 + month;
  await expect(page.locator('.net-chart-track')).toHaveCount(periods);
  await expect(page.locator('.balance-track')).toHaveCount(periods);

  for (const scrollSel of ['.net-chart-card .chart-scroll', '.total-balance-card .chart-scroll']) {
    const scroll = page.locator(scrollSel);
    await expect
      .poll(() => scroll.evaluate(el => el.scrollWidth - el.clientWidth - el.scrollLeft), {
        message: `${scrollSel} opens scrolled to the To Period`,
      })
      .toBeLessThanOrEqual(1);
    const overflow = await scroll.evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow, `${scrollSel} overflows its card`).toBeGreaterThan(0);
  }

  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(pageOverflow, 'the page itself never scrolls sideways').toBeLessThanOrEqual(0);

  /* Tracks keep the twelve-Period width: twelve of them, with their eleven
     gaps, fill the card's visible width. */
  const geo = await page.evaluate(() => {
    const scroll = document.querySelector('.net-chart-card .chart-scroll') as HTMLElement;
    const [first, second] = Array.from(document.querySelectorAll('.net-chart-track'))
      .map(track => track.getBoundingClientRect());
    return { visible: scroll.clientWidth, track: first.width, pitch: second.left - first.left };
  });
  expect(Math.abs(11 * geo.pitch + geo.track - geo.visible)).toBeLessThanOrEqual(4);

  await expect(page.locator('.net-chart-years span')).toHaveText([String(year - 1), String(year)]);
});

async function addIncome(page: Page, amount: string, date?: string) {
  await page.getByRole('button', { name: '+ Transaction' }).click();
  const form = page.locator('.transaction-form-form');
  await expect(form).toBeVisible();
  await form.locator('select[name="category"]').selectOption({ label: 'Payroll (Income)' });
  await form.locator('input[name="amount"]').fill(amount);
  if (date) await form.locator('input[name="date"]').fill(date);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.transaction-form-form')).toBeHidden();
}

async function completeOnboarding(page: Page) {
  await page.goto('/onboarding');

  // 1. Language
  await page.getByRole('button', { name: 'Continue' }).click();

  // 2. Restore: start fresh
  await page.getByRole('button', { name: 'Start fresh' }).click();

  // 3. Currency: EUR is preselected
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. Accounts
  await page.getByRole('button', { name: 'New account' }).click();
  await page.getByLabel('Account name').fill('Checking');
  await page.getByLabel('Initial balance').fill('100');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Categories: defaults are prefilled
  await page.getByRole('button', { name: 'Start Tracking' }).click();

  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

import { expect, test } from '@playwright/test';

/**
 * Issue #156 — Stats graphs: scale anchors + mirrored balance caption.
 *
 * Each graph card states its scale in the caps-label voice (figures in
 * JetBrains Mono tabular): the overview anchors its tallest column and its
 * zero line, the strip anchors its track top (or, when the year's max
 * magnitude is an overdrawn balance, that cap). The strip gains the mirrored
 * "{month} Balance" caption under it, pairing both cards' footers.
 *
 * Mobile context: 375×812 touch. Desktop context: 1280×720 mouse.
 */

test.use({ baseURL: 'http://localhost:4200' });

for (const viewport of [
  { width: 375, height: 812, hasTouch: true },
  { width: 1280, height: 720, hasTouch: false },
]) {
  test.describe(`stats scale anchors at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: viewport.hasTouch });

    test('both graph cards state their scale and the strip mirrors the caption', async ({
      page,
    }) => {
      await completeOnboarding(page);
      await addIncome(page, '3000');
      await addExpense(page, '500');

      await page.goto('/stats');

      // Overview anchor: tallest column figure; both transactions land in
      // the current Period, so nothing dips below the line and the floor
      // figure is 0.
      const overviewScale = page.locator('.overview-scale');
      await expect(overviewScale).toBeVisible();
      await expect(overviewScale).toContainText('Tallest column');
      await expect(overviewScale).toContainText('3,000.00');
      await expect(overviewScale).toContainText('Deepest overdrawn');
      await expect(overviewScale).toContainText('0.00');

      // Strip caption mirrors the overview caption's grammar.
      const balanceCaption = page.locator('.balance-caption');
      await expect(balanceCaption).toBeVisible();
      await expect(balanceCaption).toContainText('Balance');
      await expect(balanceCaption).toContainText('2,600.00');

      // Strip anchor: the positive peak (2600) is the year max magnitude.
      const balanceScale = page.locator('.balance-scale');
      await expect(balanceScale).toBeVisible();
      await expect(balanceScale).toContainText('Track top');
      await expect(balanceScale).toContainText('2,600.00');

      // Hidden figure lists untouched; legends still in place.
      await expect(page.locator('.overview-figures.visually-hidden')).toHaveCount(1);
      await expect(page.locator('.balance-figures.visually-hidden')).toHaveCount(1);
      await expect(page.locator('.overview-legend')).toBeVisible();
      await expect(page.locator('.balance-legend')).toBeVisible();

      // The anchors' figures read in the mono data voice.
      const mono = await overviewScale.locator('.value').first().evaluate((el) => {
        const s = getComputedStyle(el);
        return { family: s.fontFamily, numeric: s.fontVariantNumeric };
      });
      expect(mono.family).toContain('JetBrains Mono');
      expect(mono.numeric).toContain('tabular-nums');

      // Footer alignment: every line is a justified row — labels share the
      // left edge, figures share the right edge — and both graphs hand
      // their caption the same vertical gap.
      const geo = await page.evaluate(() => {
        const row = (sel: string) => {
          const el = document.querySelector(sel) as HTMLElement;
          const label = el.querySelector('.label')!.getBoundingClientRect();
          const value = el.querySelector('.value')!.getBoundingClientRect();
          return { labelLeft: label.left, valueRight: value.right };
        };
        const gap = (graph: string, caption: string) => {
          const g = document.querySelector(graph)!.getBoundingClientRect();
          const c = document.querySelector(caption)!.getBoundingClientRect();
          return c.top - g.bottom;
        };
        return {
          overviewCaption: row('.overview-caption'),
          overviewScale: row('.overview-scale .scale-line'),
          balanceCaption: row('.balance-caption'),
          balanceScale: row('.balance-scale .scale-line'),
          overviewGap: gap('.year-overview', '.overview-caption'),
          balanceGap: gap('.balance-strip', '.balance-caption'),
          overviewCaptionGap: gap('.overview-caption', '.overview-scale .scale-line'),
          overviewLegendGap: gap(
            '.overview-scale .scale-line:nth-child(2)',
            '.overview-legend',
          ),
          balanceLegendGap: gap('.balance-scale .scale-line', '.balance-legend'),
        };
      });
      for (const [caption, scale] of [
        [geo.overviewCaption, geo.overviewScale],
        [geo.balanceCaption, geo.balanceScale],
      ]) {
        expect(Math.abs(scale.labelLeft - caption.labelLeft), 'labels share the left edge')
          .toBeLessThanOrEqual(2);
        expect(Math.abs(scale.valueRight - caption.valueRight), 'figures share the right edge')
          .toBeLessThanOrEqual(2);
      }
      expect(Math.abs(geo.overviewGap - geo.balanceGap), 'one shared graph-to-caption gap')
        .toBeLessThanOrEqual(2);
      // Every footer gap is the same small step: caption→scale, scale→scale,
      // and scale→legend on both cards.
      for (const footerGap of [geo.overviewCaptionGap, geo.overviewLegendGap, geo.balanceLegendGap]) {
        expect(
          Math.abs(footerGap - geo.balanceGap * 0.25),
          `footer gap ${footerGap} must be a quarter of the graph gap`,
        ).toBeLessThanOrEqual(2);
      }

      await expectNoHorizontalOverflow(page);
    });
  });
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

async function addIncome(page: import('@playwright/test').Page, amount: string) {
  await page.getByRole('button', { name: '+ Transaction' }).click();
  const form = page.locator('.transaction-form-form');
  await expect(form).toBeVisible();
  await form.locator('select[name="category"]').selectOption({ label: 'Payroll (Income)' });
  await form.locator('input[name="amount"]').fill(amount);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.transaction-form-form')).toBeHidden();
}

async function addExpense(page: import('@playwright/test').Page, amount: string) {
  await page.getByRole('button', { name: '+ Transaction' }).click();
  const form = page.locator('.transaction-form-form');
  await expect(form).toBeVisible();
  await form.locator('select[name="category"]').selectOption({ label: 'Food (Expense)' });
  await form.locator('input[name="amount"]').fill(amount);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.transaction-form-form')).toBeHidden();
}

async function completeOnboarding(page: import('@playwright/test').Page) {
  await page.goto('/onboarding');

  // 1. Language
  await page.getByRole('button', { name: 'Continue' }).click();

  // 2. Restore: start fresh
  await page.getByRole('button', { name: 'Start fresh' }).click();

  // 3. Currency: EUR is preselected
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. Accounts
  await page.getByRole('button', { name: 'New account' }).click();
  await page.getByPlaceholder('Account name').fill('Checking');
  await page.getByLabel('Initial balance').fill('100');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Categories: defaults are prefilled
  await page.getByRole('button', { name: 'Start Tracking' }).click();

  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

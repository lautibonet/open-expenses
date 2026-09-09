import { expect, test } from '@playwright/test';

/**
 * Issue #157 — Stats graphs: mobile emphasis stops eating the track.
 *
 * The current-month ring is drawn without layout: the scope Period's track
 * gets a 1px ink outline (no border, no offset) that paints at the track's
 * edge and never eats the fills. Below 480px the ring drops entirely — a
 * ~22px track leaves the outline nothing to close around — and emphasis
 * moves to the month label, which reads bold ink instead of muted.
 *
 * Mobile context: 375×812 touch. Intermediate width: 768×720 — past the
 * 480px breakpoint, so it must still carry the desktop outline.
 */

test.use({ baseURL: 'http://localhost:4200' });

for (const viewport of [
  { width: 375, height: 812, hasTouch: true },
  { width: 768, height: 720, hasTouch: false },
]) {
  test.describe(`current-month emphasis at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: viewport.hasTouch });

    const mobile = viewport.width <= 480;

    test('emphasizes the current month without eating the track', async ({ page }) => {
      await completeOnboarding(page);
      await addIncome(page, '3000');

      await page.goto('/stats');

      for (const trackSel of ['.balance-track.current', '.overview-track.current']) {
        const track = page.locator(trackSel);
        await expect(track).toBeVisible();

        const style = await track.evaluate((el) => {
          const s = getComputedStyle(el);
          return {
            borderTopWidth: s.borderTopWidth,
            outlineStyle: s.outlineStyle,
            outlineWidth: s.outlineWidth,
            outlineOffset: s.outlineOffset,
          };
        });

        if (mobile) {
          // No ring at all below 480px — emphasis moves to the bold label.
          expect(style.borderTopWidth).toBe('0px');
          expect(style.outlineStyle).toBe('none');
        } else {
          // Desktop ring: a 1px ink outline at the track edge, no border.
          expect(style.borderTopWidth).toBe('0px');
          expect(style.outlineStyle).toBe('solid');
          expect(style.outlineWidth).toBe('1px');
          expect(style.outlineOffset).toBe('0px');
        }
      }

      // The emphasized month's label carries the mobile emphasis: bold ink
      // instead of the muted register, on both graphs.
      for (const labelSel of ['.balance-initial.current', '.overview-initial.current']) {
        const label = page.locator(labelSel).first();
        await expect(label).toBeVisible();
        const style = await label.evaluate((el) => {
          const s = getComputedStyle(el);
          return { fontWeight: Number(s.fontWeight), color: s.color };
        });
        expect(style.fontWeight).toBeGreaterThanOrEqual(700);
        expect(style.color).toBe('rgb(26, 28, 28)');
      }

      // The current month's fills stay visible inside the emphasized
      // tracks: each fill spans its container (the outline paints without
      // layout and never clips the fill) and carries real height (income
      // seeded above) — on both graphs. The overview splits its track into
      // three cells (income/expense/net), so its fills are a third of the
      // track by design; the span check is the meaningful one there.
      for (const [fillSel, containerSel] of [
        ['.balance-track.current .balance-fill', '.balance-track.current'],
        ['.overview-track.current .cell-fill', '.overview-track.current .overview-cell'],
      ] as const) {
        const fill = page.locator(fillSel).first();
        await expect(fill).toBeVisible();
        const [fillBox, containerWidth] = await Promise.all([
          fill.boundingBox(),
          page
            .locator(containerSel)
            .first()
            .evaluate((el) => el.clientWidth),
        ]);
        expect(fillBox).not.toBeNull();
        expect(fillBox!.height).toBeGreaterThan(0);
        expect(
          fillBox!.width,
          `fill spans its container (${fillSel})`,
        ).toBeGreaterThanOrEqual(containerWidth - 1);
      }
    });
  });
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

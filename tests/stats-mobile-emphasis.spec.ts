import { expect, test } from '@playwright/test';

/**
 * Issue #157 — Stats graphs: mobile emphasis stops eating the track.
 *
 * Below 480px a month track is roughly 22px wide and the desktop
 * current-month ring (1px ink border + 1px inset outline) eats about 18% of
 * it, fusing with the ink fills. The treatment that shipped: emphasis stays
 * on the track but the ring drops to a 2px ink border only (the inset
 * outline goes), so the emphasized month still reads as emphasized while its
 * fills stay visible. Desktop keeps the full ring.
 *
 * Mobile context: 375×812 touch. Intermediate width: 768×720 — past the
 * 480px breakpoint, so it must still carry the desktop ring.
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
            borderLeftWidth: s.borderLeftWidth,
            borderLeftStyle: s.borderLeftStyle,
            borderTopColor: s.borderTopColor,
            outlineStyle: s.outlineStyle,
            outlineWidth: s.outlineWidth,
            outlineOffset: s.outlineOffset,
          };
        });

        if (mobile) {
          // 2px ink border only — the inset outline is gone and the ring
          // closes over the shared seam (the left border re-opens).
          expect(style.borderTopWidth).toBe('2px');
          expect(style.borderLeftWidth).toBe('2px');
          expect(style.borderLeftStyle).toBe('solid');
          expect(style.borderTopColor).toBe('rgb(26, 28, 28)');
          expect(style.outlineStyle).toBe('none');
        } else {
          // Desktop ring unchanged: 1px ink border + 1px inset outline.
          expect(style.borderTopWidth).toBe('1px');
          expect(style.borderTopColor).toBe('rgb(26, 28, 28)');
          expect(style.outlineStyle).toBe('solid');
          expect(style.outlineWidth).toBe('1px');
          expect(style.outlineOffset).toBe('-2px');
        }
      }

      // The current month's fills stay visible inside the emphasized
      // tracks: each fill spans its container (the ring only insets by the
      // 2px border, never clips the fill) and carries real height (income
      // seeded above) — on both graphs. The overview splits its track into
      // three cells (income/expense/net), so its fills are a third of the
      // track by design; the span check is the meaningful one there. On the
      // strip the single fill must keep a readable width: a ~22px track
      // loses at most 4px to the 2px border, never the ~18% the old ring ate.
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
          `fill spans its container, not eaten by the emphasis border (${fillSel})`,
        ).toBeGreaterThanOrEqual(containerWidth - 1);
        if (mobile && fillSel.startsWith('.balance')) {
          expect(fillBox!.width, 'strip fill keeps a readable width at 375px')
            .toBeGreaterThanOrEqual(16);
        }
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

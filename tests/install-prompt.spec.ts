import { expect, test } from '@playwright/test';

/**
 * Issue #115 — Install prompt: remember refusals, announce itself, match the
 * strip language.
 *
 * Coarse-pointer (phone) context: 375×812 with touch enabled. The browser's
 * `beforeinstallprompt` is forced via a synthetic dispatch (Chrome only fires
 * it in real install-eligible sessions).
 */

test.use({ baseURL: 'http://localhost:4200' });
test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

test.beforeEach(async ({ page }) => {
  // Synthetic install event: a dispatched BeforeInstallPromptEvent whose
  // native dialog resolves with the chosen outcome.
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__fireInstallPrompt = (
      choice: 'accepted' | 'dismissed',
    ) => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt?: () => Promise<void>;
        userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
      };
      event.prompt = async () => {};
      event.userChoice = Promise.resolve({ outcome: choice });
      window.dispatchEvent(event);
    };
  });
});

test.describe('install prompt (#115)', () => {
  test('renders the documented Primary-Fixed strip language with a Body Caption message', async ({
    page,
  }) => {
    await completeOnboarding(page);
    await fireInstallPrompt(page, 'accepted');

    const strip = page.locator('.install-banner');
    await expect(strip).toBeVisible();

    // Polite live region: the strip announces its own appearance.
    await expect(strip).toHaveAttribute('role', 'status');

    // Strip language: Primary Fixed fill, Primary bottom hairline, non-fixed.
    const styles = await strip.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        borderBottomColor: s.borderBottomColor,
        position: s.position,
      };
    });
    expect(styles.background).toBe('rgb(221, 225, 255)'); // --primary-fixed #dde1ff
    expect(styles.borderBottomColor).toBe('rgb(0, 62, 199)'); // --primary #003ec7
    expect(styles.position).toBe('static'); // scrolls away with the page

    // Prose message in Body Caption (14px), not caps-label (12px uppercase).
    const message = await strip.locator('span').evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: s.fontSize, transform: s.textTransform };
    });
    expect(message.size).toBe('14px');
    expect(message.transform).not.toBe('uppercase');

    // Coarse-pointer touch targets stay at the 44px minimum.
    for (const name of ['Install', 'Dismiss']) {
      const box = (await strip.getByRole('button', { name }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('a declined native dialog earns the same cooldown as Dismiss', async ({ page }) => {
    await completeOnboarding(page);

    // First visit: strip appears, user declines the native dialog.
    await fireInstallPrompt(page, 'dismissed');
    const strip = page.locator('.install-banner');
    await expect(strip).toBeVisible();
    await strip.getByRole('button', { name: 'Install' }).click();
    await expect(strip).toBeHidden();
    expect(
      await page.evaluate(() =>
        localStorage.getItem('open-expenses_pwa_install_dismissed'),
      ),
    ).not.toBeNull();

    // Reload within the 7-day cooldown: the strip must not re-show.
    await page.reload();
    await resumeApp(page);
    await fireInstallPrompt(page, 'dismissed');
    await expect(page.locator('.install-banner')).toHaveCount(0);
  });

  test('the Dismiss button cooldown still suppresses the strip after reload', async ({
    page,
  }) => {
    await completeOnboarding(page);

    await fireInstallPrompt(page, 'dismissed');
    const strip = page.locator('.install-banner');
    await expect(strip).toBeVisible();
    await strip.getByRole('button', { name: 'Dismiss' }).click();
    await expect(strip).toBeHidden();

    await page.reload();
    await resumeApp(page);
    await fireInstallPrompt(page, 'dismissed');
    await expect(page.locator('.install-banner')).toHaveCount(0);
  });
});

async function resumeApp(page: import('@playwright/test').Page) {
  // After a reload the app restores its persisted data and skips onboarding.
  await page.goto('/movements');
  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

async function fireInstallPrompt(
  page: import('@playwright/test').Page,
  choice: 'accepted' | 'dismissed',
) {
  await page.evaluate((c) => {
    (
      window as unknown as {
        __fireInstallPrompt: (choice: 'accepted' | 'dismissed') => void;
      }
    ).__fireInstallPrompt(c);
  }, choice);
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
  await page.getByPlaceholder('Initial balance').fill('100');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 5. Categories: defaults are prefilled
  await page.getByRole('button', { name: 'Start Tracking' }).click();

  await expect(page.getByRole('button', { name: '+ Transaction' })).toBeVisible();
}

/*
 * Captures the README screenshots (#136): Movements and Stats at desktop
 * width, seeded with fake data, framed per the Monolith identity (hard ink
 * border, zero radius, DESIGN.md).
 *
 * Prerequisite: the dev server must be running (`npm start`, port 4200).
 *
 * Run with: node scripts/capture-screenshots.mjs
 * Writes docs/screenshots/movements.png and docs/screenshots/stats.png.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4200';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');

const INK = '#1a1c1c';
const FRAME_PX = 14;

/* Fake but plausible ledger: salary, rent, groceries, a sale, and a
   cross-currency transfer into a USD travel wallet. Months are offsets back
   from the current month so the Movements Scope lands on the present Period
   while Stats keeps its January-through-now year-to-period window. */
const TRANSACTIONS = [
  {
    monthsBack: 0,
    day: 1,
    account: 'Checking',
    category: 'Payroll (Income)',
    amount: '3850',
    note: 'Monthly salary',
  },
  {
    monthsBack: 0,
    day: 1,
    account: 'Checking',
    category: 'Second-hand Sale (Income)',
    amount: '120',
    note: 'Sold the old monitor',
  },
  {
    monthsBack: 0,
    day: 2,
    account: 'Checking',
    category: 'Food (Expense)',
    amount: '84.20',
    note: 'Weekly groceries',
  },
  {
    monthsBack: 0,
    day: 3,
    account: 'Checking',
    category: 'Transport (Expense)',
    amount: '32',
    note: 'Monthly metro pass',
  },
  {
    monthsBack: 0,
    day: 4,
    account: 'Checking',
    category: 'Leisure (Expense)',
    amount: '47.90',
    note: 'Concert tickets',
  },
  {
    monthsBack: 0,
    day: 5,
    account: 'Checking',
    category: 'Subscriptions (Expense)',
    amount: '11.99',
    note: 'Streaming plan',
  },
  {
    monthsBack: 0,
    day: 5,
    account: 'Checking',
    category: 'Misc (Expense)',
    amount: '23.75',
    note: 'Pharmacy',
  },
  {
    monthsBack: 1,
    day: 1,
    account: 'Checking',
    category: 'Payroll (Income)',
    amount: '3850',
    note: 'Monthly salary',
  },
  {
    monthsBack: 1,
    day: 2,
    account: 'Checking',
    category: 'Housing (Expense)',
    amount: '1150',
    note: 'Rent',
  },
  {
    monthsBack: 1,
    day: 15,
    account: 'Checking',
    category: 'Food (Expense)',
    amount: '96.35',
    note: 'Big shop',
  },
  {
    monthsBack: 1,
    day: 20,
    account: 'Checking',
    category: 'Leisure (Expense)',
    amount: '30',
    note: 'Cinema',
  },
  {
    monthsBack: 2,
    day: 1,
    account: 'Checking',
    category: 'Payroll (Income)',
    amount: '3850',
    note: 'Monthly salary',
  },
  {
    monthsBack: 2,
    day: 2,
    account: 'Checking',
    category: 'Housing (Expense)',
    amount: '1150',
    note: 'Rent',
  },
  {
    monthsBack: 2,
    day: 10,
    account: 'Checking',
    category: 'Transport (Expense)',
    amount: '28.40',
    note: 'Fuel',
  },
  {
    monthsBack: 2,
    day: 18,
    account: 'Checking',
    category: 'Refund (Income)',
    amount: '60',
    note: 'Flight refund',
  },
  {
    monthsBack: 3,
    day: 1,
    account: 'Checking',
    category: 'Payroll (Income)',
    amount: '3850',
    note: 'Monthly salary',
  },
  {
    monthsBack: 3,
    day: 2,
    account: 'Checking',
    category: 'Housing (Expense)',
    amount: '1150',
    note: 'Rent',
  },
  {
    monthsBack: 3,
    day: 12,
    account: 'Checking',
    category: 'Food (Expense)',
    amount: '88.10',
    note: 'Dinner with friends',
  },
  {
    monthsBack: 4,
    day: 1,
    account: 'Checking',
    category: 'Payroll (Income)',
    amount: '3850',
    note: 'Monthly salary',
  },
  {
    monthsBack: 4,
    day: 2,
    account: 'Checking',
    category: 'Housing (Expense)',
    amount: '1150',
    note: 'Rent',
  },
  {
    monthsBack: 4,
    day: 21,
    account: 'Checking',
    category: 'Leisure (Expense)',
    amount: '54.20',
    note: 'Board games',
  },
  {
    monthsBack: 6,
    day: 1,
    account: 'Checking',
    category: 'Payroll (Income)',
    amount: '3850',
    note: 'Monthly salary',
  },
  {
    monthsBack: 6,
    day: 2,
    account: 'Checking',
    category: 'Housing (Expense)',
    amount: '1150',
    note: 'Rent',
  },
  {
    monthsBack: 7,
    day: 9,
    account: 'Checking',
    category: 'Second-hand Sale (Income)',
    amount: '95',
    note: 'Sold the old phone',
  },
  {
    monthsBack: 8,
    day: 2,
    account: 'Checking',
    category: 'Housing (Expense)',
    amount: '1150',
    note: 'Rent',
  },
  {
    monthsBack: 8,
    day: 6,
    account: 'Checking',
    category: 'Misc (Expense)',
    amount: '35.50',
    note: 'Winter boots',
  },
];

const TRANSFERS = [
  { monthsBack: 0, day: 1, from: 'Savings', to: 'Checking', amount: '400', note: 'Monthly sweep' },
  {
    monthsBack: 6,
    day: 15,
    from: 'Checking',
    to: 'Savings',
    amount: '250',
    note: 'Quarterly savings',
  },
  // Cross-currency: the rate is filled by hand so the capture never depends
  // on the Frankfurter fetch succeeding.
  {
    monthsBack: 1,
    day: 3,
    from: 'Checking',
    to: 'Travel wallet',
    amount: '300',
    note: 'Trip cash',
    rate: '1.09',
  },
];

function isoDate({ monthsBack, day }) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, day);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  locale: 'en-US',
});
const page = await context.newPage();

try {
  // Onboarding: English, start fresh, EUR base, three accounts.
  await page.goto(`${BASE_URL}/onboarding`);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start fresh' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByPlaceholder('Account name').fill('Checking');
  await page.getByPlaceholder('Initial balance').fill('3200');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('Account name').fill('Savings');
  await page.getByPlaceholder('Initial balance').fill('7500');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByPlaceholder('Account name').fill('Travel wallet');
  await page.getByRole('combobox', { name: 'Account currency' }).selectOption('USD');
  await page.getByPlaceholder('Initial balance').fill('500');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('button', { name: 'Start Tracking' }).click();
  await page
    .getByRole('button', { name: '+ Transaction', exact: true })
    .waitFor({ state: 'visible', timeout: 10000 });
  await dismissInstallPrompt(page);

  for (const t of TRANSACTIONS) {
    await page.getByRole('button', { name: '+ Transaction', exact: true }).click();
    const form = page.locator('.transaction-form-form');
    await form.waitFor({ state: 'visible', timeout: 10000 });
    await form.locator('select[name="account"]').selectOption({ label: `${t.account} (EUR)` });
    await form.locator('select[name="category"]').selectOption({ label: t.category });
    await form.locator('input[name="amount"]').fill(t.amount);
    await form.locator('input[name="note"]').fill(t.note);
    await form.locator('input[name="date"]').fill(isoDate(t));
    await form.getByRole('button', { name: 'Save' }).click();
    await form.waitFor({ state: 'hidden', timeout: 10000 });
  }

  for (const t of TRANSFERS) {
    await page.getByRole('button', { name: '+ Transfer', exact: true }).click();
    const form = page.locator('.form-card');
    await form.waitFor({ state: 'visible', timeout: 10000 });
    await form.locator('select[name="sourceAccount"]').selectOption({ label: t.from });
    await form.locator('select[name="destAccount"]').selectOption({ label: t.to });
    await form.locator('input[name="sourceAmount"]').fill(t.amount);
    await form.locator('input[name="date"]').fill(isoDate(t));
    await form.locator('input[name="note"]').fill(t.note);
    if (t.rate) {
      // Wait for the automatic Frankfurter fetch to settle (success or
      // failure) so the manual fill below is not overwritten in flight.
      await page
        .locator('.exchange-rate-section .rate-status')
        .waitFor({ state: 'hidden', timeout: 8000 })
        .catch(() => {});
      await form.locator('input[name="rate"]').fill(t.rate);
    }
    await form.getByRole('button', { name: 'Save' }).click();
    await form.waitFor({ state: 'hidden', timeout: 10000 });
  }

  mkdirSync(OUT_DIR, { recursive: true });
  await captureScreen(
    page,
    'movements',
    `${BASE_URL}/movements`,
    '.movement-table tbody tr:not(.day-divider)',
  );
  await captureScreen(page, 'stats', `${BASE_URL}/stats`, 'main.content');
  console.log('Screenshots written to docs/screenshots/');
} finally {
  await browser.close();
}

/* The Monolith frame (#123): a hard ink ring around the whole app, zero
   radius, no shadow. The transform on app-root turns it into the containing
   block for the fixed sidebar, so the ring wraps the shell too. */
async function captureScreen(page, name, url, waitFor) {
  await page.goto(url);
  await page.locator(waitFor).first().waitFor({ state: 'visible', timeout: 10000 });
  await dismissInstallPrompt(page);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: `
      body {
        margin: 0;
        box-sizing: border-box;
        padding: ${FRAME_PX}px;
        background: ${INK};
      }
      app-root {
        display: block;
        transform: translateZ(0);
        min-height: calc(100vh - ${FRAME_PX * 2}px);
        background: #f9f9f9;
      }
    `,
  });
  await page.locator('body').screenshot({
    path: join(OUT_DIR, `${name}.png`),
  });
  console.log(`Captured ${name}.png`);
}

async function dismissInstallPrompt(page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

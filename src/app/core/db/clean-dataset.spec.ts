import { describe, it, expect } from 'vitest';
import { cleanDataset, Dataset } from './clean-dataset';

function emptyDataset(): Dataset {
  return { accounts: [], categories: [], transactions: [], transfers: [], profile: [] };
}

function calendarDay(date: Date): [number, number, number] {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

describe('cleanDataset', () => {
  describe('Movement Dates', () => {
    it('turns a restored UTC-midnight date text into a local-midnight date of the same day', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transactions: [{ id: 1, date: '2026-09-01T00:00:00.000Z', period: 9, year: 2026 }],
      });

      const [txn] = cleaned.transactions;
      expect(txn.date).toBeInstanceOf(Date);
      expect(calendarDay(txn.date)).toEqual([2026, 9, 1]);
      expect([txn.date.getHours(), txn.date.getMinutes()]).toEqual([0, 0]);
    });

    it('leaves a date that carries a time of day untouched', () => {
      const withTime = new Date(2026, 8, 1, 10, 30);
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transfers: [{ id: 1, date: withTime.toISOString(), period: 9, year: 2026 }],
      });

      expect(cleaned.transfers[0].date.getTime()).toBe(withTime.getTime());
    });
  });

  describe('legacy row shapes', () => {
    it('makes an account without a kind a Cash Account and drops the orphan Linked Account field', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        accounts: [
          { id: 1, name: 'Cash' },
          { id: 2, name: 'Visa', kind: 'credit-card', linkedAccountId: 1, paymentCategoryId: 9 },
        ],
        categories: [{ id: 9, name: 'Visa payment', type: 'expense' }],
      });

      expect(cleaned.accounts.map((a) => a.kind)).toEqual(['cash', 'credit-card']);
      expect('linkedAccountId' in cleaned.accounts[1]).toBe(false);
    });

    it('converts legacy category types to codes and leaves unknown ones as they are', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        categories: [
          { id: 1, type: 'Expense' },
          { id: 2, type: 'Income' },
          { id: 3, type: 'checking' },
        ],
      });

      expect(cleaned.categories.map((c) => c.type)).toEqual(['expense', 'income', 'checking']);
    });

    it('converts English month names to month numbers and leaves unknown periods as they are', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transactions: [
          { id: 1, date: '2026-01-15T00:00:00.000Z', period: 'January', year: 2026 },
          { id: 2, date: '2026-01-20T00:00:00.000Z', period: 'Enero', year: 2026 },
          { id: 3, date: '2026-05-20T00:00:00.000Z', period: 13, year: 2026 },
        ],
        transfers: [{ id: 1, date: '2026-02-01T00:00:00.000Z', period: 'February', year: 2026 }],
      });

      expect(cleaned.transactions.map((t) => t.period)).toEqual([1, 'Enero', 13]);
      expect(cleaned.transfers.map((t) => t.period)).toEqual([2]);
    });

    it('spreads a single-amount legacy transfer into same-currency amounts', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transfers: [{ id: 1, amount: 150, date: '2026-02-01T00:00:00.000Z', period: 2, year: 2026 }],
      });

      const [transfer] = cleaned.transfers;
      expect([
        transfer.sourceAmount,
        transfer.destinationAmount,
        transfer.exchangeRate,
        transfer.baseCurrencyAmount,
      ]).toEqual([150, 150, 1, null]);
      expect('amount' in transfer).toBe(false);
    });

    it('keeps a transfer that already carries its amounts', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transfers: [{
          id: 1, sourceAmount: 100, destinationAmount: 85, exchangeRate: 0.85,
          baseCurrencyAmount: 100, date: '2026-02-01T00:00:00.000Z', period: 2, year: 2026,
        }],
      });

      const [transfer] = cleaned.transfers;
      expect([transfer.sourceAmount, transfer.destinationAmount, transfer.exchangeRate])
        .toEqual([100, 85, 0.85]);
    });

    it('drops the retired tags field from transactions', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transactions: [{ id: 1, date: '2026-01-15T00:00:00.000Z', period: 1, year: 2026, tags: ['x'] }],
      });

      expect('tags' in cleaned.transactions[0]).toBe(false);
    });
  });

  describe('Payment Category link', () => {
    it('creates the missing Payment Category under the next free id and links the card', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        accounts: [
          { id: 1, name: 'Cash', kind: 'cash' },
          { id: 2, name: 'Visa', kind: 'credit-card' },
        ],
        categories: [{ id: 4, name: 'Food', type: 'expense', active: true }],
      });

      expect(cleaned.accounts[1].paymentCategoryId).toBe(5);
      expect(cleaned.categories[1]).toMatchObject({
        id: 5, name: 'Visa payment', type: 'expense', active: true,
      });
      expect(cleaned.categories[1].createdAt).toBeInstanceOf(Date);
      expect(cleaned.accounts[0].paymentCategoryId).toBeUndefined();
    });

    it('names the created category in the dataset Language', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        accounts: [{ id: 1, name: 'Visa', kind: 'credit-card' }],
        profile: [{ id: 1, language: 'es' }],
      });

      expect(cleaned.categories.map((c) => c.name)).toEqual(['Pago Visa']);
    });

    it('links an Expense category already holding the payment name instead of duplicating it', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        accounts: [{ id: 1, name: 'Visa', kind: 'credit-card' }],
        categories: [{ id: 3, name: 'visa PAYMENT', type: 'expense' }],
      });

      expect(cleaned.accounts[0].paymentCategoryId).toBe(3);
      expect(cleaned.categories).toHaveLength(1);
    });

    it('leaves a card unlinked when an Income category holds its payment name', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        accounts: [{ id: 1, name: 'Visa', kind: 'credit-card' }],
        categories: [{ id: 3, name: 'Visa payment', type: 'income' }],
      });

      expect(cleaned.accounts[0].paymentCategoryId).toBeUndefined();
      expect(cleaned.categories).toHaveLength(1);
    });

    it('clears a dangling link when an Income category holds the payment name', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        accounts: [{ id: 1, name: 'Visa', kind: 'credit-card', paymentCategoryId: 42 }],
        categories: [{ id: 3, name: 'Visa payment', type: 'income' }],
      });

      expect('paymentCategoryId' in cleaned.accounts[0]).toBe(false);
    });

    it('keeps a stored link and gives each unlinked card its own category', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        accounts: [
          { id: 1, name: 'Visa', kind: 'credit-card', paymentCategoryId: 7 },
          { id: 2, name: 'Master', kind: 'credit-card' },
          { id: 3, name: 'Amex', kind: 'credit-card' },
        ],
        categories: [{ id: 7, name: 'Mine', type: 'expense' }],
      });

      expect(cleaned.accounts.map((a) => a.paymentCategoryId)).toEqual([7, 8, 9]);
      expect(cleaned.categories.map((c) => c.name)).toEqual([
        'Mine', 'Master payment', 'Amex payment',
      ]);
    });
  });

  it('changes nothing when cleaning an already-clean dataset', () => {
    const once = cleanDataset({
      accounts: [{ id: 1, name: 'Visa', initialBalance: 0, createdAt: '2026-01-01T00:00:00.000Z' }],
      categories: [{ id: 1, name: 'Food', type: 'Expense', createdAt: '2026-01-01T00:00:00.000Z' }],
      transactions: [{ id: 1, date: '2026-01-01T00:00:00.000Z', period: 'January', tags: [] }],
      transfers: [{ id: 1, amount: 5, date: '2026-01-02T00:00:00.000Z', period: 1 }],
      profile: [{ id: 1, language: 'en', lastBackupAt: '2026-08-27T00:00:00.000Z' }],
    });

    expect(cleanDataset(once)).toEqual(once);
  });

  describe('Transfer base amount (ADR 0028)', () => {
    /* Base Currency USD: account 1 is EUR cash, 2 a EUR card, 3 USD cash, 4 GBP cash. */
    function datasetWith(transfers: any[]): Dataset {
      return {
        ...emptyDataset(),
        accounts: [
          { id: 1, name: 'Euros', currency: 'EUR', kind: 'cash', initialBalance: 0 },
          { id: 2, name: 'Visa', currency: 'EUR', kind: 'credit-card', initialBalance: 0, paymentCategoryId: 1 },
          { id: 3, name: 'Dollars', currency: 'USD', kind: 'cash', initialBalance: 0 },
          { id: 4, name: 'Pounds', currency: 'GBP', kind: 'cash', initialBalance: 0 },
        ],
        categories: [{ id: 1, name: 'Visa payment', type: 'expense', system: true }],
        profile: [{ id: 1, baseCurrency: 'USD', language: 'en' }],
        transfers,
      };
    }

    function transfer(fields: any): any {
      return { id: 1, date: '2026-02-01T00:00:00.000Z', period: 2, year: 2026, exchangeRate: 1, ...fields };
    }

    it('repairs a transfer whose source is in the Base Currency to its source amount', () => {
      const cleaned = cleanDataset(datasetWith([transfer({
        sourceAccountId: 3, destinationAccountId: 1,
        sourceAmount: 105, destinationAmount: 100, exchangeRate: 0.9524, baseCurrencyAmount: 100,
      })]));
      expect(cleaned.transfers[0].baseCurrencyAmount).toBe(105);
    });

    it('repairs a transfer whose destination is in the Base Currency to its destination amount', () => {
      const cleaned = cleanDataset(datasetWith([transfer({
        sourceAccountId: 1, destinationAccountId: 3,
        sourceAmount: 95, destinationAmount: 100, exchangeRate: 1.0526, baseCurrencyAmount: 95,
      })]));
      expect(cleaned.transfers[0].baseCurrencyAmount).toBe(100);
    });

    it('marks a transfer between two foreign accounts without a base rate as unconverted', () => {
      const cleaned = cleanDataset(datasetWith([transfer({
        sourceAccountId: 1, destinationAccountId: 2,
        sourceAmount: 100, destinationAmount: 100, baseCurrencyAmount: 100,
      })]));
      expect(cleaned.transfers[0].baseCurrencyAmount).toBeNull();
    });

    it('keeps the captured base amount of a transfer carrying a base rate', () => {
      const cleaned = cleanDataset(datasetWith([transfer({
        sourceAccountId: 1, destinationAccountId: 4,
        sourceAmount: 100, destinationAmount: 85, exchangeRate: 0.85,
        baseExchangeRate: 1.1, baseCurrencyAmount: 110,
      })]));
      expect(cleaned.transfers[0].baseCurrencyAmount).toBe(110);
      expect(cleaned.transfers[0].baseExchangeRate).toBe(1.1);
    });

    it('drops a base rate left on a transfer with an account in the Base Currency', () => {
      const cleaned = cleanDataset(datasetWith([transfer({
        sourceAccountId: 3, destinationAccountId: 1,
        sourceAmount: 100, destinationAmount: 90, exchangeRate: 0.9,
        baseExchangeRate: 1.3, baseCurrencyAmount: 130,
      })]));
      expect(cleaned.transfers[0].baseCurrencyAmount).toBe(100);
      expect('baseExchangeRate' in cleaned.transfers[0]).toBe(false);
    });

    it('marks a single-amount legacy transfer between two foreign accounts as unconverted', () => {
      const cleaned = cleanDataset(datasetWith([
        { id: 1, sourceAccountId: 1, destinationAccountId: 2, amount: 150, date: '2026-02-01T00:00:00.000Z', period: 2, year: 2026 },
      ]));
      expect(cleaned.transfers[0].baseCurrencyAmount).toBeNull();
    });

    it('changes nothing when cleaning the repaired transfers again', () => {
      const once = cleanDataset(datasetWith([
        transfer({ id: 1, sourceAccountId: 3, destinationAccountId: 1, sourceAmount: 105, destinationAmount: 100, baseCurrencyAmount: 100 }),
        transfer({ id: 2, sourceAccountId: 1, destinationAccountId: 2, sourceAmount: 100, destinationAmount: 100, baseCurrencyAmount: 100 }),
        transfer({ id: 3, sourceAccountId: 1, destinationAccountId: 4, sourceAmount: 100, destinationAmount: 85, baseExchangeRate: 1.1, baseCurrencyAmount: 110 }),
      ]));
      expect(cleanDataset(once)).toEqual(once);
    });
  });

  describe('creation and backup times', () => {
    it('turns restored instants back into dates without moving them', () => {
      const instant = '2026-01-01T00:00:00.000Z';
      const cleaned = cleanDataset({
        accounts: [{ id: 1, kind: 'cash', createdAt: instant }],
        categories: [{ id: 1, type: 'expense', createdAt: instant }],
        transactions: [{ id: 1, date: instant, period: 1, year: 2026, createdAt: instant }],
        transfers: [{ id: 1, date: instant, period: 1, year: 2026, createdAt: instant }],
        profile: [{ id: 1, lastBackupAt: '2026-08-27T13:45:00.000Z' }],
      });

      for (const row of [
        cleaned.accounts[0],
        cleaned.categories[0],
        cleaned.transactions[0],
        cleaned.transfers[0],
      ]) {
        expect(row.createdAt).toEqual(new Date(instant));
      }
      expect(cleaned.profile[0].lastBackupAt).toEqual(new Date('2026-08-27T13:45:00.000Z'));
    });

    it('keeps a missing backup time and text that is not a date as they are', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        profile: [{ id: 1, lastBackupAt: null }],
        categories: [{ id: 1, type: 'expense', createdAt: 'not a date' }],
      });

      expect(cleaned.profile[0].lastBackupAt).toBeNull();
      expect(cleaned.categories[0].createdAt).toBe('not a date');
    });
  });

  describe('Period year', () => {
    it('backfills a missing year from the picked day, so January 1st keeps its year west of UTC', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transactions: [{ id: 1, date: '2025-01-01T00:00:00.000Z', period: 1 }],
      });

      expect(cleaned.transactions[0].year).toBe(2025);
    });

    it('never rewrites a stored year', () => {
      const cleaned = cleanDataset({
        ...emptyDataset(),
        transfers: [{ id: 1, date: '2025-12-30T00:00:00.000Z', period: 1, year: 2026 }],
      });

      expect(cleaned.transfers[0].year).toBe(2026);
    });
  });
});

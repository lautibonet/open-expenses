import { TestBed } from '@angular/core/testing';
import { TransferService } from './transfer.service';
import { AccountService } from './account.service';
import { CategoryService } from './category.service';
import { ProfileService } from './profile.service';
import { db } from '../db/database';
import { getCurrentYear } from '../types/period.type';

describe('TransferService', () => {
  let transferService: TransferService;
  let accountService: AccountService;
  let cashId: number;
  let savingsId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    transferService = TestBed.inject(TransferService);
    accountService = TestBed.inject(AccountService);

    const cash = await accountService.create('Cash', 'EUR', 100000);
    cashId = cash.id!;
    const savings = await accountService.create('Savings', 'EUR', 500000);
    savingsId = savings.id!;
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should create a transfer', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 1);
    expect(t.id).toBeDefined();
    expect(t.sourceAccountId).toBe(cashId);
    expect(t.destinationAccountId).toBe(savingsId);
    expect(t.sourceAmount).toBe(50000);
    expect(t.destinationAmount).toBe(50000);
    expect(t.exchangeRate).toBe(1);
    expect(t.baseCurrencyAmount).toBe(50000);
  });

  it('should create transfer with note', async () => {
    const t = await transferService.create(
      cashId, savingsId, 50000, new Date(), 1, 'Monthly savings',
    );
    expect(t.note).toBe('Monthly savings');
  });

  it('should reject self-transfer', async () => {
    await expect(
      transferService.create(cashId, cashId, 50000, new Date(), 1),
    ).rejects.toThrow('errors.accountsMustDiffer');
  });

  it('should reject zero amount', async () => {
    await expect(
      transferService.create(cashId, savingsId, 0, new Date(), 1),
    ).rejects.toThrow('errors.amountPositive');
  });

  it('should reject negative amount', async () => {
    await expect(
      transferService.create(cashId, savingsId, -100, new Date(), 1),
    ).rejects.toThrow('errors.amountPositive');
  });

  it('should reject an out-of-range period', async () => {
    await expect(
      transferService.create(cashId, savingsId, 100, new Date(), 13),
    ).rejects.toThrow('errors.periodInvalid');
  });

  it('should reject invalid source account', async () => {
    await expect(
      transferService.create(999, savingsId, 100, new Date(), 1),
    ).rejects.toThrow('errors.sourceAccountNotFound');
  });

  it('should reject invalid destination account', async () => {
    await expect(
      transferService.create(cashId, 999, 100, new Date(), 1),
    ).rejects.toThrow('errors.destinationAccountNotFound');
  });

  it('should update a transfer', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 1);
    const updated = await transferService.update(t.id!, { sourceAmount: 60000, destinationAmount: 60000, note: 'Updated' });
    expect(updated.sourceAmount).toBe(60000);
    expect(updated.destinationAmount).toBe(60000);
    expect(updated.note).toBe('Updated');
  });

  it('should create a cross-currency transfer with explicit rate', async () => {
    const usd = await accountService.create('USD Account', 'USD', 100000);
    const t = await transferService.create(
      cashId, usd.id!, 1000, new Date('2026-01-15'), 1, '', 1.08,
    );
    expect(t.sourceAmount).toBe(1000);
    expect(t.destinationAmount).toBe(1080);
    expect(t.exchangeRate).toBe(1.08);
    expect(t.baseCurrencyAmount).toBe(1000);
  });

  it('should update a cross-currency transfer and recalculate amounts', async () => {
    const usd = await accountService.create('USD Account', 'USD', 100000);
    const t = await transferService.create(
      cashId, usd.id!, 1000, new Date('2026-01-15'), 1, '', 1.08,
    );
    const updated = await transferService.update(t.id!, { sourceAmount: 2000, exchangeRate: 1.1 });
    expect(updated.sourceAmount).toBe(2000);
    expect(updated.destinationAmount).toBe(2200);
    expect(updated.exchangeRate).toBe(1.1);
    expect(updated.baseCurrencyAmount).toBe(2000);
  });

  it('should reject self-transfer on update (both fields)', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 1);
    await expect(
      transferService.update(t.id!, { sourceAccountId: savingsId, destinationAccountId: savingsId }),
    ).rejects.toThrow('errors.accountsMustDiffer');
  });

  it('should reject self-transfer on update (single field change)', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 1);
    await expect(
      transferService.update(t.id!, { sourceAccountId: savingsId }),
    ).rejects.toThrow('errors.accountsMustDiffer');
  });

  it('should delete a transfer', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 1);
    await transferService.delete(t.id!);
    const found = await transferService.getById(t.id!);
    expect(found).toBeUndefined();
  });

  it('should restore a deleted transfer with its original id and fields', async () => {
    const t = await transferService.create(
      cashId, savingsId, 50000, new Date('2026-01-15'), 1, 'savings', 1.08, 2026,
    );
    const snapshot = { ...t };
    await transferService.delete(t.id!);
    expect(await transferService.getById(t.id!)).toBeUndefined();

    await transferService.restore(snapshot);

    const restored = await transferService.getById(t.id!);
    expect(restored).toBeDefined();
    expect(restored!.id).toBe(t.id);
    expect(restored!.sourceAccountId).toBe(t.sourceAccountId);
    expect(restored!.destinationAccountId).toBe(t.destinationAccountId);
    expect(restored!.sourceAmount).toBe(t.sourceAmount);
    expect(restored!.destinationAmount).toBe(t.destinationAmount);
    expect(restored!.exchangeRate).toBe(1.08);
    expect(restored!.baseCurrencyAmount).toBe(t.baseCurrencyAmount);
    expect(restored!.period).toBe(1);
    expect(restored!.year).toBe(2026);
    expect(restored!.note).toBe('savings');
  });

  it('should reject restoring a transfer that still exists', async () => {
    const t = await transferService.create(cashId, savingsId, 50000, new Date('2026-01-15'), 1);
    await expect(
      transferService.restore(t),
    ).rejects.toThrow('errors.transferExists');
  });

  it('should default the period year to the current year', async () => {
    const t = await transferService.create(cashId, savingsId, 100, new Date('2025-12-22'), 1);
    expect(t.year).toBe(getCurrentYear());
  });

  it('should store an explicit period year different from the date year', async () => {
    const t = await transferService.create(
      cashId, savingsId, 100, new Date('2025-12-22'), 1, '', 1, 2026,
    );
    expect(t.date.getFullYear()).toBe(2025);
    expect(t.year).toBe(2026);
  });

  it('should update the period year', async () => {
    const t = await transferService.create(cashId, savingsId, 100, new Date('2025-12-22'), 1);
    const updated = await transferService.update(t.id!, { year: 2025 });
    expect(updated.year).toBe(2025);
  });

  it('should reject an invalid period year on create', async () => {
    await expect(
      transferService.create(cashId, savingsId, 100, new Date(), 1, '', 1, 22),
    ).rejects.toThrow('errors.yearInvalid');
  });

  it('should reject an invalid period year on update', async () => {
    const t = await transferService.create(cashId, savingsId, 100, new Date(), 1);
    await expect(
      transferService.update(t.id!, { year: 22 }),
    ).rejects.toThrow('errors.yearInvalid');
  });

  describe('Card Payments (ADR 0022)', () => {
    let categoryService: CategoryService;
    let cardId: number;
    let expenseId: number;
    let incomeId: number;

    beforeEach(async () => {
      categoryService = TestBed.inject(CategoryService);
      const card = await accountService.createCard({
        name: 'Visa',
        currency: 'EUR',
      });
      cardId = card.id!;
      expenseId = card.paymentCategoryId!;
      const income = await categoryService.create('Salary', 'income');
      incomeId = income.id!;
    });

    it('resolves the card payment category on a Cash-to-Card Transfer without being told', async () => {
      const t = await transferService.create(
        cashId, cardId, 500, new Date(), 1, '', 1, getCurrentYear(),
      );
      expect(t.categoryId).toBe(expenseId);
    });

    it('resolves the card payment category on a Card-to-Card Transfer too', async () => {
      const card2 = await accountService.createCard({ name: 'Master', currency: 'EUR' });
      const t = await transferService.create(cardId, card2.id!, 500, new Date(), 1);
      expect(t.categoryId).toBe(card2.paymentCategoryId);
    });

    it('wears the card payment category even when an update carries a stale category', async () => {
      const t = await transferService.create(cashId, cardId, 500, new Date(), 1);
      const updated = await transferService.update(t.id!, { categoryId: incomeId });
      expect(updated.categoryId).toBe(expenseId);
    });

    it('refuses a Card Payment into a card that owns no Payment Category, never resolving one by name', async () => {
      await db.accounts.update(cardId, { paymentCategoryId: undefined });

      await expect(transferService.create(cashId, cardId, 500, new Date(), 1))
        .rejects.toThrow('errors.cardHasNoPaymentCategory');
      expect(await db.transfers.count()).toBe(0);
      expect((await db.accounts.get(cardId))!.paymentCategoryId).toBeUndefined();
    });

    it('refuses a Card Payment into a card whose Payment Category link dangles', async () => {
      await db.categories.delete(expenseId);

      await expect(transferService.create(cashId, cardId, 500, new Date(), 1))
        .rejects.toThrow('errors.cardHasNoPaymentCategory');
    });

    it('refuses redirecting a Transfer into a card that owns no Payment Category', async () => {
      const t = await transferService.create(cashId, savingsId, 500, new Date(), 1);
      await db.accounts.update(cardId, { paymentCategoryId: undefined });

      await expect(transferService.update(t.id!, { destinationAccountId: cardId }))
        .rejects.toThrow('errors.cardHasNoPaymentCategory');
      expect((await db.transfers.get(t.id!))!.destinationAccountId).toBe(savingsId);
    });

    it('carries no category on a Cash-to-Cash Transfer', async () => {
      const t = await transferService.create(
        cashId, savingsId, 500, new Date(), 1, '', 1, getCurrentYear(),
      );
      expect(t.categoryId).toBeUndefined();
    });

    it('resolves the card payment category when a Transfer is redirected into a Card', async () => {
      const t = await transferService.create(cashId, savingsId, 500, new Date(), 1);
      const updated = await transferService.update(t.id!, { destinationAccountId: cardId });
      expect(updated.categoryId).toBe(expenseId);
    });

    it('re-resolves to the new card payment category when the destination changes cards', async () => {
      const card2 = await accountService.createCard({ name: 'Master', currency: 'EUR' });
      const t = await transferService.create(
        cashId, cardId, 500, new Date(), 1, '', 1, getCurrentYear(),
      );
      const updated = await transferService.update(t.id!, {
        destinationAccountId: card2.id!,
      });
      expect(updated.categoryId).toBe(card2.paymentCategoryId);
      expect(updated.categoryId).not.toBe(expenseId);
    });

    it('clears the category when a Card Payment is redirected to Cash', async () => {
      const t = await transferService.create(
        cashId, cardId, 500, new Date(), 1, '', 1, getCurrentYear(),
      );
      const updated = await transferService.update(t.id!, { destinationAccountId: savingsId });
      expect(updated.categoryId).toBeUndefined();
    });
  });

  describe('base amount (ADR 0028)', () => {
    let usdId: number;
    let gbpId: number;

    beforeEach(async () => {
      await TestBed.inject(ProfileService).completeOnboarding('USD');
      usdId = (await accountService.create('Checking', 'USD', 0)).id!;
      gbpId = (await accountService.create('Pounds', 'GBP', 0)).id!;
    });

    it('converts the source side with the base rate when neither account is in the Base Currency', async () => {
      const t = await transferService.create(
        cashId, savingsId, 100, new Date(), 1, '', 1, getCurrentYear(), 1.1,
      );
      expect(t.baseCurrencyAmount).toBe(110);
      expect(t.baseExchangeRate).toBe(1.1);
    });

    it('counts the source amount when the source account is in the Base Currency', async () => {
      const t = await transferService.create(usdId, cashId, 105, new Date(), 1, '', 0.95);
      expect(t.baseCurrencyAmount).toBe(105);
      expect(t.baseExchangeRate).toBeUndefined();
    });

    it('counts the destination amount when only the destination account is in the Base Currency', async () => {
      const t = await transferService.create(cashId, usdId, 95, new Date(), 1, '', 1.05);
      expect(t.baseCurrencyAmount).toBe(99.75);
      expect(t.baseExchangeRate).toBeUndefined();
    });

    it('ignores a base rate when one account is already in the Base Currency', async () => {
      const t = await transferService.create(
        usdId, cashId, 100, new Date(), 1, '', 0.9, getCurrentYear(), 1.3,
      );
      expect(t.baseCurrencyAmount).toBe(100);
      expect(t.baseExchangeRate).toBeUndefined();
    });

    it('refuses a Transfer between two foreign accounts without a base rate', async () => {
      await expect(transferService.create(cashId, gbpId, 100, new Date(), 1, '', 0.85))
        .rejects.toThrow('errors.baseExchangeRateRequired');
      expect(await db.transfers.count()).toBe(0);
    });

    it('refuses a non-positive base rate', async () => {
      await expect(
        transferService.create(cashId, gbpId, 100, new Date(), 1, '', 0.85, getCurrentYear(), 0),
      ).rejects.toThrow('errors.exchangeRatePositive');
    });

    it('re-derives the base amount from the base rate when an edit changes the amount', async () => {
      const t = await transferService.create(
        cashId, savingsId, 100, new Date(), 1, '', 1, getCurrentYear(), 1.1,
      );
      const updated = await transferService.update(t.id!, { sourceAmount: 200 });
      expect(updated.baseCurrencyAmount).toBe(220);
      expect(updated.baseExchangeRate).toBe(1.1);
    });

    it('takes a new base rate on edit', async () => {
      const t = await transferService.create(
        cashId, savingsId, 100, new Date(), 1, '', 1, getCurrentYear(), 1.1,
      );
      const updated = await transferService.update(t.id!, { baseExchangeRate: 1.2 });
      expect(updated.baseCurrencyAmount).toBe(120);
    });

    it('asks for a base rate when an edit moves a Transfer away from the Base Currency', async () => {
      const t = await transferService.create(cashId, usdId, 100, new Date(), 1, '', 1.05);
      await expect(transferService.update(t.id!, { destinationAccountId: gbpId, exchangeRate: 0.85 }))
        .rejects.toThrow('errors.baseExchangeRateRequired');
      expect((await db.transfers.get(t.id!))!.destinationAccountId).toBe(usdId);

      const updated = await transferService.update(t.id!, {
        destinationAccountId: gbpId, exchangeRate: 0.85, baseExchangeRate: 1.1,
      });
      expect(updated.baseCurrencyAmount).toBe(110);
    });

    it('drops the base rate when an edit brings an account into the Base Currency', async () => {
      const t = await transferService.create(
        cashId, savingsId, 100, new Date(), 1, '', 1, getCurrentYear(), 1.1,
      );
      const updated = await transferService.update(t.id!, { destinationAccountId: usdId, exchangeRate: 1.05 });
      expect(updated.baseCurrencyAmount).toBe(105);
      expect(updated.baseExchangeRate).toBeUndefined();
    });
  });
});

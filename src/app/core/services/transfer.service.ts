import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Transfer } from '../models/transfer.model';
import { TranslationError } from '../models/translation-error';
import {
  PeriodScope,
  getCurrentYear,
  getPeriodYear,
  isValidPeriod,
  isValidYear,
} from '../types/period.type';

@Injectable({ providedIn: 'root' })
export class TransferService {
  async create(
    sourceAccountId: number,
    destinationAccountId: number,
    amount: number,
    date: Date,
    period: number,
    note: string = '',
    exchangeRate: number = 1,
    year: number = getCurrentYear(),
  ): Promise<Transfer> {
    if (sourceAccountId === destinationAccountId) {
      throw new TranslationError('errors.accountsMustDiffer');
    }
    if (amount <= 0) {
      throw new TranslationError('errors.amountPositive');
    }
    if (!isValidPeriod(period)) {
      throw new TranslationError('errors.periodInvalid');
    }
    if (exchangeRate <= 0) {
      throw new TranslationError('errors.exchangeRatePositive');
    }
    if (!isValidYear(year)) {
      throw new TranslationError('errors.yearInvalid');
    }

    const sourceAccount = await db.accounts.get(sourceAccountId);
    if (!sourceAccount) {
      throw new TranslationError('errors.sourceAccountNotFound');
    }

    const destAccount = await db.accounts.get(destinationAccountId);
    if (!destAccount) {
      throw new TranslationError('errors.destinationAccountNotFound');
    }

    const sourceAmount = amount;
    const destinationAmount = Math.round(amount * exchangeRate * 100) / 100;
    const baseCurrencyAmount = sourceAccount.currency !== destAccount.currency
      ? destinationAmount
      : sourceAmount;

    const transfer: Transfer = {
      sourceAccountId,
      destinationAccountId,
      sourceAmount,
      destinationAmount,
      exchangeRate,
      baseCurrencyAmount,
      date,
      period,
      year,
      note,
      createdAt: new Date(),
    };

    const id = await db.transfers.add(transfer);
    return { ...transfer, id };
  }

  async update(
    id: number,
    changes: Partial<Omit<Transfer, 'id' | 'createdAt'>>,
  ): Promise<Transfer> {
    const existing = await db.transfers.get(id);
    if (!existing) {
      throw new TranslationError('errors.transferNotFound');
    }

    if (changes.sourceAccountId !== undefined || changes.destinationAccountId !== undefined) {
      const src = changes.sourceAccountId ?? existing.sourceAccountId;
      const dst = changes.destinationAccountId ?? existing.destinationAccountId;
      if (src === dst) {
        throw new TranslationError('errors.accountsMustDiffer');
      }
    }

    const newSourceAmount = changes.sourceAmount ?? existing.sourceAmount;
    if (changes.sourceAmount !== undefined && changes.sourceAmount <= 0) {
      throw new TranslationError('errors.sourceAmountPositive');
    }

    const newExchangeRate = changes.exchangeRate ?? existing.exchangeRate;
    if (newExchangeRate <= 0) {
      throw new TranslationError('errors.exchangeRatePositive');
    }

    if (changes.year !== undefined && !isValidYear(changes.year)) {
      throw new TranslationError('errors.yearInvalid');
    }

    if (changes.period !== undefined && !isValidPeriod(changes.period)) {
      throw new TranslationError('errors.periodInvalid');
    }

    const newDestinationAccountId = changes.destinationAccountId ?? existing.destinationAccountId;
    const newSourceAccountId = changes.sourceAccountId ?? existing.sourceAccountId;
    const sourceAccount = await db.accounts.get(newSourceAccountId);
    const destAccount = await db.accounts.get(newDestinationAccountId);
    const isCrossCurrency = sourceAccount && destAccount && sourceAccount.currency !== destAccount.currency;
    const newDestinationAmount = Math.round(newSourceAmount * newExchangeRate * 100) / 100;
    const newBaseCurrencyAmount = isCrossCurrency ? newDestinationAmount : newSourceAmount;

    const mergedChanges = {
      ...changes,
      sourceAmount: newSourceAmount,
      destinationAmount: newDestinationAmount,
      exchangeRate: newExchangeRate,
      baseCurrencyAmount: newBaseCurrencyAmount,
    };

    await db.transfers.update(id, mergedChanges);
    return (await db.transfers.get(id))!;
  }

  async delete(id: number): Promise<void> {
    const existing = await db.transfers.get(id);
    if (!existing) {
      throw new TranslationError('errors.transferNotFound');
    }
    await db.transfers.delete(id);
  }

  async restore(snapshot: Transfer): Promise<Transfer> {
    if (!snapshot.id) {
      throw new TranslationError('errors.transferIdRequired');
    }
    const existing = await db.transfers.get(snapshot.id);
    if (existing) {
      throw new TranslationError('errors.transferExists');
    }
    const { id, ...fields } = snapshot;
    await db.transfers.add({ ...fields, id });
    return (await db.transfers.get(id))!;
  }

  async getAll(): Promise<Transfer[]> {
    return db.transfers.toArray();
  }

  async getByPeriod(period: number, year?: number): Promise<Transfer[]> {
    const transfers = await db.transfers.where('period').equals(period as any).toArray();
    if (year === undefined) {
      return transfers;
    }
    return transfers.filter(t => getPeriodYear(t) === year);
  }

  async getByScope(scope: PeriodScope): Promise<Transfer[]> {
    if (scope.kind === 'all-time') {
      return this.getAll();
    }
    return this.getByPeriod(scope.period, scope.year);
  }

  async getById(id: number): Promise<Transfer | undefined> {
    return db.transfers.get(id);
  }
}

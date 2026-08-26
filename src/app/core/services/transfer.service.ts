import { Injectable, inject } from '@angular/core';
import { db } from '../db/database';
import { Transfer } from '../models/transfer.model';
import { DriveBackupService } from './drive-backup.service';

@Injectable({ providedIn: 'root' })
export class TransferService {
  private backupService = inject(DriveBackupService);
  async create(
    sourceAccountId: number,
    destinationAccountId: number,
    amount: number,
    date: Date,
    period: string,
    note: string = '',
    exchangeRate: number = 1,
  ): Promise<Transfer> {
    if (sourceAccountId === destinationAccountId) {
      throw new Error('Source and destination accounts must be different');
    }
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!period) {
      throw new Error('Period is required');
    }
    if (exchangeRate <= 0) {
      throw new Error('Exchange rate must be positive');
    }

    const sourceAccount = await db.accounts.get(sourceAccountId);
    if (!sourceAccount) {
      throw new Error('Source account not found');
    }

    const destAccount = await db.accounts.get(destinationAccountId);
    if (!destAccount) {
      throw new Error('Destination account not found');
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
      note,
      createdAt: new Date(),
    };

    const id = await db.transfers.add(transfer);
    this.backupService.scheduleAutoBackup();
    return { ...transfer, id };
  }

  async update(
    id: number,
    changes: Partial<Omit<Transfer, 'id' | 'createdAt'>>,
  ): Promise<Transfer> {
    const existing = await db.transfers.get(id);
    if (!existing) {
      throw new Error('Transfer not found');
    }

    if (changes.sourceAccountId !== undefined || changes.destinationAccountId !== undefined) {
      const src = changes.sourceAccountId ?? existing.sourceAccountId;
      const dst = changes.destinationAccountId ?? existing.destinationAccountId;
      if (src === dst) {
        throw new Error('Source and destination accounts must be different');
      }
    }

    const newSourceAmount = changes.sourceAmount ?? existing.sourceAmount;
    if (changes.sourceAmount !== undefined && changes.sourceAmount <= 0) {
      throw new Error('Source amount must be positive');
    }

    const newExchangeRate = changes.exchangeRate ?? existing.exchangeRate;
    if (newExchangeRate <= 0) {
      throw new Error('Exchange rate must be positive');
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
    this.backupService.scheduleAutoBackup();
    return (await db.transfers.get(id))!;
  }

  async delete(id: number): Promise<void> {
    const existing = await db.transfers.get(id);
    if (!existing) {
      throw new Error('Transfer not found');
    }
    await db.transfers.delete(id);
    this.backupService.scheduleAutoBackup();
  }

  async getAll(): Promise<Transfer[]> {
    return db.transfers.toArray();
  }

  async getByPeriod(period: string): Promise<Transfer[]> {
    return db.transfers.where('period').equals(period).toArray();
  }

  async getById(id: number): Promise<Transfer | undefined> {
    return db.transfers.get(id);
  }
}

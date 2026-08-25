import { Injectable, inject } from '@angular/core';
import { db } from '../db/database';
import { Account } from '../models/account.model';
import { DriveBackupService } from './drive-backup.service';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private backupService = inject(DriveBackupService);
  async create(name: string, currency: string, initialBalance: number): Promise<Account> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Account name is required');
    }
    if (initialBalance < 0) {
      throw new Error('Initial balance cannot be negative');
    }

    const existing = await db.accounts.where('name').equals(trimmedName).first();
    if (existing) {
      throw new Error('Account name must be unique');
    }

    const account: Account = {
      name: trimmedName,
      currency: currency.toUpperCase(),
      initialBalance,
      active: true,
      createdAt: new Date(),
    };

    const id = await db.accounts.add(account);
    this.backupService.scheduleAutoBackup();
    return { ...account, id };
  }

  async update(id: number, changes: { name?: string; initialBalance?: number }): Promise<Account> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new Error('Account not found');
    }

    if (changes.name !== undefined) {
      const trimmedName = changes.name.trim();
      if (!trimmedName) {
        throw new Error('Account name is required');
      }
      const existing = await db.accounts.where('name').equals(trimmedName).first();
      if (existing && existing.id !== id) {
        throw new Error('Account name must be unique');
      }
      await db.accounts.update(id, { name: trimmedName });
    }

    if (changes.initialBalance !== undefined) {
      if (changes.initialBalance < 0) {
        throw new Error('Initial balance cannot be negative');
      }
      await db.accounts.update(id, { initialBalance: changes.initialBalance });
    }

    this.backupService.scheduleAutoBackup();
    return (await db.accounts.get(id))!;
  }

  async setActive(id: number, active: boolean): Promise<void> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new Error('Account not found');
    }
    await db.accounts.update(id, { active });
    this.backupService.scheduleAutoBackup();
  }

  async getAll(): Promise<Account[]> {
    return db.accounts.toArray();
  }

  async getActive(): Promise<Account[]> {
    return db.accounts.filter(a => a.active).toArray();
  }

  async getById(id: number): Promise<Account | undefined> {
    return db.accounts.get(id);
  }
}

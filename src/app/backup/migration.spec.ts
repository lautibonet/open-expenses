import { describe, it, expect } from 'vitest';
import { isBackupSnapshotShape } from './backup-snapshot';
import type { SheetRow } from '../../../scripts/migrate.js';
import {
  parseAccounts,
  parseCategories,
  parseCsv,
  parseDate,
  parseMovements,
  buildBackup,
  isBackupShape,
  reconciliation,
} from '../../../scripts/migrate.js';

describe('sheet-to-backup migration', () => {
  describe('parseCsv', () => {
    it('handles quoted fields containing commas', () => {
      const rows = parseCsv(
        'a,b,c\nlun 1 ene,Enero,"€1.234,56",x\n"has, comma",z,"nested ""quote"""\n',
      );
      expect(rows[0]).toEqual(['a', 'b', 'c']);
      expect(rows[1]).toEqual(['lun 1 ene', 'Enero', '€1.234,56', 'x']);
      expect(rows[2]).toEqual(['has, comma', 'z', 'nested "quote"']);
    });
  });

  describe('parseAccounts', () => {
    it('parses name and balanced amount, and rejects a missing header', () => {
      const accounts = parseAccounts('Cuentas\tMonto;Inicial\nEfectivo;€792,01\nN26 - Lautaro;€12.062,06\n');
      expect(accounts).toEqual([
        { name: 'Efectivo', initialBalance: 792.01 },
        { name: 'N26 - Lautaro', initialBalance: 12062.06 },
      ]);
      expect(() => parseAccounts('Efectivo;€792,01\n')).toThrow();
    });
  });

  describe('parseCategories', () => {
    it('reads one category per line', () => {
      expect(parseCategories('Salida - Delivery\nIngreso - Nómina\n')).toEqual([
        'Salida - Delivery',
        'Ingreso - Nómina',
      ]);
    });
  });

  describe('parseMovements', () => {
    it('parses rows and their amounts', () => {
      const rows = parseMovements(
        'Fecha,Período,Entrada / Salida,Monto,Categoría,Cuenta,Comentario\n' +
          'lun 22 dic,Enero,Ingreso,"€2.544,95",Ingreso - Nómina,N26 - Lautaro,Note, extra\n',
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        dateCell: 'lun 22 dic',
        period: 'Enero',
        type: 'Ingreso',
        amount: 2544.95,
        category: 'Ingreso - Nómina',
        account: 'N26 - Lautaro',
      });
    });
  });

  describe('parseDate', () => {
    it('places December-dated rows in the previous calendar year', () => {
      expect(parseDate('lun 22 dic')).toBe('2025-12-22T00:00:00.000Z');
    });

    it('keeps other months in the sheet year', () => {
      expect(parseDate('jue 25 dic')).toContain('2025-12-25');
      expect(parseDate('mar 25 ago')).toBe('2026-08-25T00:00:00.000Z');
    });
  });

  describe('buildBackup', () => {
    const accountsSpec = [
      { name: 'Efectivo', initialBalance: 792.01 },
      { name: 'N26 - Lautaro', initialBalance: 12062.06 },
      { name: 'N26 - Leila', initialBalance: 66.17 },
      { name: 'Brubank', initialBalance: 408.26 },
      { name: 'IBKR', initialBalance: 801.89 },
    ];

    const categoriesSpec = [
      'Salida - Delivery',
      'Salida - Supermercado',
      'Salida - Transferencia Interna',
      'Ingreso - Nómina',
      'Ingreso - Transferencia Interna',
    ];

    const movements: SheetRow[] = [
      // January pay cycle: a December-dated transaction in the January Period.
      {
        dateCell: 'lun 22 dic',
        period: 'Enero',
        type: 'Ingreso',
        amount: 2544.95,
        category: 'Ingreso - Nómina',
        account: 'N26 - Lautaro',
        comment: '',
      },
      {
        dateCell: 'vie 26 dic',
        period: 'Enero',
        type: 'Salida',
        amount: 68.07,
        category: 'Salida - Supermercado',
        account: 'N26 - Lautaro',
        comment: 'Weekly shop',
      },
      // A single internal-transfer pair reassembles into one Transfer.
      {
        dateCell: 'jue 22 ene',
        period: 'Enero',
        type: 'Salida',
        amount: 790.68,
        category: 'Salida - Transferencia Interna',
        account: 'IBKR',
        comment: 'Transferencia de fondos',
      },
      {
        dateCell: 'jue 22 ene',
        period: 'Enero',
        type: 'Ingreso',
        amount: 790.68,
        category: 'Ingreso - Transferencia Interna',
        account: 'N26 - Lautaro',
        comment: 'Transferencia de fondos',
      },
    ];

    it('emits a backup that passes the app backup shape check', () => {
      const { snapshot } = buildBackup(accountsSpec, categoriesSpec, movements);
      expect(isBackupSnapshotShape(snapshot)).toBe(true);
    });

    it('seeds the accounts, Base Currency EUR and a completed profile', () => {
      const { snapshot } = buildBackup(accountsSpec, categoriesSpec, movements);
      expect(snapshot.accounts).toHaveLength(5);
      expect(snapshot.accounts.every((a) => a.currency === 'EUR')).toBe(true);
      expect(snapshot.accounts.map((a) => a.initialBalance)).toEqual([
        792.01, 12062.06, 66.17, 408.26, 801.89,
      ]);
      expect(snapshot.profile).toEqual([
        { id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: null },
      ]);
    });

    it('emits only the Categories actually used by Transactions', () => {
      const { snapshot } = buildBackup(accountsSpec, categoriesSpec, movements);
      const names = snapshot.categories.map((c) => c.name);
      expect(names).toContain('Salida - Supermercado');
      expect(names).toContain('Ingreso - Nómina');
      expect(names).not.toContain('Salida - Delivery');
      expect(names).not.toContain('Salida - Transferencia Interna');
      expect(names).not.toContain('Ingreso - Transferencia Interna');
    });

    it('reassembles the transfer pair and creates no Transaction for it', () => {
      const { snapshot } = buildBackup(accountsSpec, categoriesSpec, movements);
      expect(snapshot.transfers).toHaveLength(1);
      expect(snapshot.transactions).toHaveLength(2);

      const transfer = snapshot.transfers[0];
      const srcName = snapshot.accounts.find((a) => a.id === transfer.sourceAccountId)!.name;
      const dstName = snapshot.accounts.find((a) => a.id === transfer.destinationAccountId)!.name;
      expect(srcName).toBe('IBKR');
      expect(dstName).toBe('N26 - Lautaro');
      expect(transfer.sourceAmount).toBe(790.68);
      expect(transfer.destinationAmount).toBe(790.68);
      expect(transfer.exchangeRate).toBe(1);
      expect(transfer.baseCurrencyAmount).toBe(790.68);
      expect(transfer.note).toBe('Transferencia de fondos');
    });

    it('maps the sheet Period to the app month name and stores its year', () => {
      const { snapshot } = buildBackup(accountsSpec, categoriesSpec, movements);
      expect(snapshot.transactions[0].period).toBe('January');
      expect(snapshot.transactions[0].year).toBe(2026);
    });

    it('carries the Comentario through as the Transaction note', () => {
      const { snapshot } = buildBackup(accountsSpec, categoriesSpec, movements);
      expect(snapshot.transactions[1].note).toBe('Weekly shop');
      expect(snapshot.transactions[0].note).toBe('');
    });

    it('reports the source row count it was built from', () => {
      const { stats } = buildBackup(accountsSpec, categoriesSpec, movements);
      expect(stats.movements).toBe(4);
      expect(stats.transactions).toBe(2);
      expect(stats.transfers).toBe(1);
    });

    it('rejects a transfer Ingreso row with no Salida pair', () => {
      const stray: SheetRow[] = [{
        dateCell: 'lun 22 dic', period: 'Enero', type: 'Ingreso', amount: 10,
        category: 'Ingreso - Transferencia Interna', account: 'N26 - Lautaro', comment: '',
      }];
      expect(() => buildBackup(accountsSpec, categoriesSpec, stray)).toThrow(/no Salida pair/i);
    });
  });

  describe('isBackupShape', () => {
    const { snapshot } = buildBackup(
      [{ name: 'A', initialBalance: 1 }],
      ['Ingreso - Nómina'],
      [{
        dateCell: 'lun 22 dic', period: 'Enero', type: 'Ingreso', amount: 10,
        category: 'Ingreso - Nómina', account: 'A', comment: '',
      }],
    );

    it('accepts a well-formed backup and rejects malformed values', () => {
      expect(isBackupShape(snapshot)).toBe(true);
      expect(isBackupShape({ ...snapshot, accounts: 'nope' })).toBe(false);
      expect(isBackupShape(null)).toBe(false);
    });
  });

  describe('reconciliation', () => {
    it('computes per-account and per-category totals', () => {
      const { snapshot } = buildBackup(
        [{ name: 'Brubank', initialBalance: 408.26 }],
        ['Salida - Otros', 'Ingreso - Nómina'],
        [
          {
            dateCell: 'mié 25 mar', period: 'Marzo', type: 'Salida', amount: 21.75,
            category: 'Salida - Otros', account: 'Brubank', comment: 'Regalo',
          },
          {
            dateCell: 'vie 27 mar', period: 'Abril', type: 'Ingreso', amount: 4647.86,
            category: 'Ingreso - Nómina', account: 'Brubank', comment: '',
          },
        ],
      );

      const report = reconciliation(snapshot, 2);
      expect(report.movementCount).toBe(2);
      expect(report.transactionCount).toBe(2);
      expect(report.transferCount).toBe(0);
      expect(report.accountTotals).toEqual([{ name: 'Brubank', initialBalance: 408.26, total: 4626.11 }]);
      expect(report.categoryTotals).toEqual([
        { name: 'Ingreso - Nómina', total: 4647.86 },
        { name: 'Salida - Otros', total: -21.75 },
      ]);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { DriveBackupService } from './drive-backup.service';
import { ProfileService } from './profile.service';
import { NetworkService } from './network.service';
import { AccountService } from './account.service';
import { CategoryService } from './category.service';
import { TransactionService } from './transaction.service';
import { TransferService } from './transfer.service';
import { LanguageService } from './language.service';
import { db } from '../db/database';
import { TranslationError } from '../models/translation-error';
import { BackupSnapshot } from '../../backup/backup-snapshot';
import { DataVersionService } from './data-version.service';

function mockTokenClient(token = 'test-token', autoFire = true) {
  const configStore: any[] = [];

  (globalThis as any).google = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn((config: any) => {
          configStore.push(config);
          return {
            requestAccessToken: vi.fn(() => {
              if (autoFire && config.callback) {
                config.callback({ access_token: token, expires_in: 3600 });
              }
            }),
          };
        }),
      },
    },
  };

  return {
    fireCallback(response: any) {
      configStore[configStore.length - 1].callback(response);
    },
  };
}

async function connectAsTestUser(service: DriveBackupService, token = 'test-token') {
  mockTokenClient(token);
  await service.connect();
}

function mockFetchByUrl(
  handlers: Record<string, (init?: RequestInit) => unknown>,
  fallback: (init?: RequestInit) => unknown = () => ({}),
) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const matched = Object.entries(handlers).find(([needle]) => url.includes(needle));
      const result = matched ? matched[1](init) : fallback(init);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(result),
        text: () => Promise.resolve(JSON.stringify(result)),
      } as Response);
    }),
  );
}

const FOLDER_SEARCH = 'Expenses';
const FILE_SEARCH = 'open-expenses-backup.json';
const MEDIA_DOWNLOAD = 'alt=media';

describe('DriveBackupService', () => {
  let service: DriveBackupService;
  let profileService: ProfileService;
  let accountService: AccountService;
  let categoryService: CategoryService;
  let transactionService: TransactionService;
  let transferService: TransferService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();

    if (!globalThis.crypto) {
      (globalThis as any).crypto = {};
    }
    if (!globalThis.crypto.subtle) {
      (globalThis as any).crypto.subtle = {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      };
    }

    TestBed.configureTestingModule({});
    service = TestBed.inject(DriveBackupService);
    profileService = TestBed.inject(ProfileService);
    accountService = TestBed.inject(AccountService);
    categoryService = TestBed.inject(CategoryService);
    transactionService = TestBed.inject(TransactionService);
    transferService = TestBed.inject(TransferService);

    await profileService.completeOnboarding('EUR');
  });

  afterEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (globalThis as any).google;
    await db.delete();
  });

  describe('initial state', () => {
    it('should not be connected initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should not be backing up initially', () => {
      expect(service.isBackingUp()).toBe(false);
    });

    it('should have null lastBackupAt initially', () => {
      expect(service.lastBackupAt()).toBeNull();
    });

    it('should have no error initially', () => {
      expect(service.error()).toBeNull();
    });
  });

  describe('connect', () => {
    it('should call Google Identity Services initTokenClient', async () => {
      mockTokenClient();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response),
      );
      await connectAsTestUser(service);

      expect((globalThis as any).google.accounts.oauth2.initTokenClient).toHaveBeenCalled();
    });

    it('should set connected to true after successful auth', async () => {
      await connectAsTestUser(service);

      expect(service.isConnected()).toBe(true);
    });

    it('should store token in localStorage', async () => {
      await connectAsTestUser(service, 'stored-token');

      const stored = localStorage.getItem('open-expenses_google_token');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.accessToken).toBe('stored-token');
    });

    it('should set error if OAuth returns error', async () => {
      const client = mockTokenClient('test-token', false);

      service.connect().catch(() => {});
      await new Promise((r) => setTimeout(r, 0));
      client.fireCallback({ error: 'access_denied' });

      await new Promise((r) => setTimeout(r, 0));
      expect(service.isConnected()).toBe(false);
      expect(service.error()).toBe('access_denied');
    });
  });

  describe('disconnect', () => {
    it('should revoke token and set disconnected', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({});
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
    });

    it('should remove token from localStorage', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({});
      await service.disconnect();

      expect(localStorage.getItem('open-expenses_google_token')).toBeNull();
    });
  });

  describe('backupNow', () => {
    it('should connect and back up when not connected', async () => {
      mockTokenClient();

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [] }),
      });

      await service.backupNow();

      expect(service.isConnected()).toBe(true);
      expect(service.lastBackupAt()).toBeInstanceOf(Date);
    });

    it('should throw when offline', async () => {
      const networkService = TestBed.inject(NetworkService);
      networkService.isOnline.set(false);

      await expect(service.backupNow()).rejects.toThrow('backup.error.offlineBackup');
      expect(service.isConnected()).toBe(false);
    });

    it('should create a backup inside the Open Expenses folder', async () => {
      await connectAsTestUser(service);

      await accountService.create('Cash', 'EUR', 10000);
      await categoryService.create('Food', 'expense');

      const urls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string, init?: RequestInit) => {
          urls.push(url);
          let result: unknown = { id: 'file-id-1' };
          if (url.includes(FOLDER_SEARCH)) {
            result = { files: [] };
          } else if (url.includes(FILE_SEARCH)) {
            result = { files: [] };
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(result),
          } as Response);
        }),
      );

      await service.backupNow();

      expect(service.isBackingUp()).toBe(false);
      expect(service.lastBackupAt()).toBeInstanceOf(Date);
      expect(urls.some((u) => u.includes(FOLDER_SEARCH))).toBe(true);
      expect(urls.some((u) => u.includes('upload/drive/v3/files'))).toBe(true);
    });

    it('should update existing file if backup already exists', async () => {
      await connectAsTestUser(service);

      await accountService.create('Cash', 'EUR', 0);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'existing-file-id' }] }),
      });

      await service.backupNow();

      const calls = vi.mocked(fetch).mock.calls as [string][];
      expect(calls.some(([url]) => url.includes('upload/drive/v3/files/existing-file-id'))).toBe(true);
    });

    it('should set error on upload failure', async () => {
      await connectAsTestUser(service);

      await accountService.create('Cash', 'EUR', 0);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: { message: 'Server error' } }),
        } as Response),
      );

      await expect(service.backupNow()).rejects.toThrow();
      expect(service.error()).toBeTruthy();
      expect(service.isBackingUp()).toBe(false);
    });
  });

  describe('restore', () => {
    it('should throw if not connected', async () => {
      await expect(service.restore()).rejects.toThrow('backup.error.notConnected');
    });

    it('should throw if no backup file exists', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [] }),
      });

      await expect(service.restore()).rejects.toThrow('No backup found');
    });

    it('should overwrite local IndexedDB with backup data', async () => {
      await connectAsTestUser(service);

      const snapshot: BackupSnapshot = {
        accounts: [{ id: 1, name: 'Restored Cash', currency: 'EUR', initialBalance: 5000, active: true, createdAt: new Date().toISOString() }],
        categories: [{ id: 1, name: 'Food', type: 'expense', active: true, createdAt: new Date().toISOString() }],
        transactions: [],
        transfers: [],
        profile: [{ id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: null }],
        exportedAt: new Date().toISOString(),
      };

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => snapshot,
      });

      await service.restore();

      const accounts = await db.accounts.toArray();
      expect(accounts.length).toBe(1);
      expect(accounts[0].name).toBe('Restored Cash');
      expect(service.isConnected()).toBe(true);
    });

    it('should not trigger a new backup when restoring from cloud', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          accounts: [],
          categories: [],
          transactions: [],
          transfers: [],
          profile: [],
          exportedAt: new Date().toISOString(),
        }),
      });

      const backupSpy = vi.spyOn(service, 'backupNow');

      await service.restore();

      expect(backupSpy).not.toHaveBeenCalled();
    });

    it('migrates a legacy cloud snapshot to locale-neutral storage', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          accounts: [],
          categories: [{ id: 1, name: 'Food', type: 'Expense', active: true, createdAt: new Date().toISOString() }],
          transactions: [
            {
              id: 1, accountId: 1, categoryId: 1, amount: 100,
              date: '2026-01-15T00:00:00.000Z', period: 'January', year: 2026,
              exchangeRate: null, baseCurrencyAmount: null, note: '',
              createdAt: new Date().toISOString(),
            },
          ],
          transfers: [],
          profile: [],
          exportedAt: new Date().toISOString(),
        }),
      });

      await service.restore();

      const categories = await db.categories.toArray();
      const transactions = await db.transactions.toArray();
      expect(categories[0].type).toBe('expense');
      expect(transactions[0].period).toBe(1);
    });

    it('rejects a newer-version cloud snapshot with a clear message', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          schemaVersion: 999,
          accounts: [],
          categories: [],
          transactions: [],
          transfers: [],
          profile: [],
          exportedAt: new Date().toISOString(),
        }),
      });

      await expect(service.restore()).rejects.toThrow('backup.error.newerVersion');
      expect((service.error() as TranslationError).key).toBe('backup.error.newerVersion');
    });

    it('bumps the data version after a successful cloud restore', async () => {
      await connectAsTestUser(service);
      const dataVersion = TestBed.inject(DataVersionService);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          accounts: [],
          categories: [],
          transactions: [],
          transfers: [],
          profile: [],
          exportedAt: new Date().toISOString(),
        }),
      });

      const before = dataVersion.version();
      await service.restore();

      expect(dataVersion.version()).toBe(before + 1);
    });

    it('refreshes the last-backup status from the restored profile immediately', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          accounts: [],
          categories: [],
          transactions: [],
          transfers: [],
          profile: [
            { id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: '2026-08-27T10:00:00.000Z' },
          ],
          exportedAt: new Date().toISOString(),
        }),
      });

      await service.restore();

      expect(service.lastBackupAt()).toBeInstanceOf(Date);
      expect(service.lastBackupAt()!.getTime()).toBe(new Date('2026-08-27T10:00:00.000Z').getTime());
    });

    it('does not bump the data version when the cloud restore fails', async () => {
      await connectAsTestUser(service);
      const dataVersion = TestBed.inject(DataVersionService);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          schemaVersion: 999,
          accounts: [],
          categories: [],
          transactions: [],
          transfers: [],
          profile: [],
          exportedAt: new Date().toISOString(),
        }),
      });

      await expect(service.restore()).rejects.toThrow();
      expect(dataVersion.version()).toBe(0);
    });

    it('leaves the displayed last-backup status untouched when the restore fails', async () => {
      await connectAsTestUser(service);
      const previous = new Date('2026-01-01T00:00:00.000Z');
      service.lastBackupAt.set(previous);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          schemaVersion: 999,
          accounts: [],
          categories: [],
          transactions: [],
          transfers: [],
          profile: [],
          exportedAt: new Date().toISOString(),
        }),
      });

      await expect(service.restore()).rejects.toThrow();
      expect(service.lastBackupAt()).toBe(previous);
    });
  });

  describe('restoreFromFile', () => {
    it('should overwrite local IndexedDB with backup file data', async () => {
      await accountService.create('Cash', 'EUR', 100);

      const snapshot: BackupSnapshot = {
        accounts: [
          { id: 1, name: 'Restored Savings', currency: 'USD', initialBalance: 20000, active: true, createdAt: new Date().toISOString() },
        ],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [{ id: 1, baseCurrency: 'USD', onboardingCompleted: true, lastBackupAt: null }],
        exportedAt: new Date().toISOString(),
      };
      const file = new File([JSON.stringify(snapshot)], 'open-expenses-backup.json', {
        type: 'application/json',
      });

      await service.restoreFromFile(file);

      const accounts = await db.accounts.toArray();
      expect(accounts.length).toBe(1);
      expect(accounts[0].name).toBe('Restored Savings');
    });

    it('should throw on invalid JSON', async () => {
      const file = new File(['not json'], 'backup.json', { type: 'application/json' });

      await expect(service.restoreFromFile(file)).rejects.toThrow();
    });

    it('should throw when the file is not a backup snapshot', async () => {
      const file = new File([JSON.stringify({ foo: 'bar' })], 'backup.json', {
        type: 'application/json',
      });

      await expect(service.restoreFromFile(file)).rejects.toThrow();
    });

    it('restores a legacy backup file and migrates it to locale-neutral storage', async () => {
      const legacy = {
        accounts: [],
        categories: [{ id: 1, name: 'Payroll', type: 'Income', active: true, createdAt: new Date().toISOString() }],
        transactions: [],
        transfers: [
          {
            id: 1, sourceAccountId: 1, destinationAccountId: 1,
            sourceAmount: 100, destinationAmount: 100, exchangeRate: 1, baseCurrencyAmount: 100,
            date: '2026-02-01T00:00:00.000Z', period: 'February', year: 2026,
            note: '', createdAt: new Date().toISOString(),
          },
        ],
        profile: [],
        exportedAt: new Date().toISOString(),
      };
      const file = new File([JSON.stringify(legacy)], 'backup.json', { type: 'application/json' });

      await service.restoreFromFile(file);

      const categories = await db.categories.toArray();
      const transfers = await db.transfers.toArray();
      expect(categories[0].type).toBe('income');
      expect(transfers[0].period).toBe(2);
    });

    it('rejects a newer-version backup file with a clear message', async () => {
      const newer = {
        schemaVersion: 999,
        accounts: [],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [],
        exportedAt: new Date().toISOString(),
      };
      const file = new File([JSON.stringify(newer)], 'backup.json', { type: 'application/json' });

      await expect(service.restoreFromFile(file)).rejects.toThrow('backup.error.newerVersion');
    });

    it('should not trigger a new backup when restoring from a file', async () => {
      const backupSpy = vi.spyOn(service, 'backupNow');
      const file = new File(
        [JSON.stringify({ accounts: [], categories: [], transactions: [], transfers: [], profile: [], exportedAt: new Date().toISOString() })],
        'backup.json',
        { type: 'application/json' },
      );

      await service.restoreFromFile(file);

      expect(backupSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCloudSnapshot', () => {
    it('returns the latest snapshot without overwriting local data', async () => {
      await connectAsTestUser(service);
      await accountService.create('Old Cash', 'EUR', 100);

      const snapshot: BackupSnapshot = {
        accounts: [{ id: 1, name: 'Restored Cash', currency: 'EUR', initialBalance: 5000, active: true, createdAt: new Date().toISOString() }],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => snapshot,
      });

      const result = await service.getCloudSnapshot();

      expect(result).toEqual(snapshot);

      const accounts = await db.accounts.toArray();
      expect(accounts.length).toBe(1);
      expect(accounts[0].name).toBe('Old Cash');
    });

    it('connects first when not connected', async () => {
      mockTokenClient();

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [{ id: 'backup-file-id' }] }),
        [MEDIA_DOWNLOAD]: () => ({
          accounts: [],
          categories: [],
          transactions: [],
          transfers: [],
          profile: [],
          exportedAt: new Date().toISOString(),
        }),
      });

      await service.getCloudSnapshot();

      expect(service.isConnected()).toBe(true);
    });

    it('throws when offline', async () => {
      await connectAsTestUser(service);
      TestBed.inject(NetworkService).isOnline.set(false);

      await expect(service.getCloudSnapshot()).rejects.toThrow('backup.error.offlineRestore');
    });

    it('throws when no backup exists', async () => {
      await connectAsTestUser(service);

      mockFetchByUrl({
        [FOLDER_SEARCH]: () => ({ files: [{ id: 'folder-1' }] }),
        [FILE_SEARCH]: () => ({ files: [] }),
      });

      await expect(service.getCloudSnapshot()).rejects.toThrow('No backup found');
    });
  });

  describe('parseBackupFile', () => {
    it('returns a validated snapshot from a file', async () => {
      const snapshot: BackupSnapshot = {
        accounts: [{ id: 1, name: 'Cash', currency: 'EUR', initialBalance: 1000, active: true, createdAt: new Date().toISOString() }],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };
      const file = new File([JSON.stringify(snapshot)], 'open-expenses-backup.json', {
        type: 'application/json',
      });

      const parsed = await service.parseBackupFile(file);

      expect(parsed).toEqual(snapshot);
      expect(parsed.exportedAt).toBe('2026-08-27T00:00:00.000Z');
    });

    it('throws on invalid JSON', async () => {
      const file = new File(['not json'], 'backup.json', { type: 'application/json' });

      await expect(service.parseBackupFile(file)).rejects.toThrow('backup.error.invalidFile');
    });

    it('throws when the file is not a backup snapshot', async () => {
      const file = new File([JSON.stringify({ foo: 'bar' })], 'backup.json', {
        type: 'application/json',
      });

      await expect(service.parseBackupFile(file)).rejects.toThrow('backup.error.invalidFile');
    });
  });

  describe('restoreFromSnapshot', () => {
    it('replaces the full local dataset with the snapshot', async () => {
      await accountService.create('Old Cash', 'EUR', 100);

      const snapshot: BackupSnapshot = {
        accounts: [{ id: 1, name: 'Restored Savings', currency: 'USD', initialBalance: 20000, active: true, createdAt: new Date().toISOString() }],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [{ id: 1, baseCurrency: 'USD', onboardingCompleted: true, lastBackupAt: null }],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      await service.restoreFromSnapshot(snapshot);

      const accounts = await db.accounts.toArray();
      expect(accounts.length).toBe(1);
      expect(accounts[0].name).toBe('Restored Savings');
      expect(accounts[0].currency).toBe('USD');
      expect(service.isBackingUp()).toBe(false);
    });

    it('does not trigger a new backup', async () => {
      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      await service.restoreFromSnapshot(snapshot);

      expect(service.lastBackupAt()).toBeNull();
    });

    it('applies the language of the restored backup', async () => {
      const languageService = TestBed.inject(LanguageService);
      await languageService.init();
      expect(languageService.activeLanguage()).toBe('en');

      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [
          { id: 1, baseCurrency: 'EUR', language: 'es', onboardingCompleted: true, lastBackupAt: null },
        ],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      await service.restoreFromSnapshot(snapshot);

      expect(languageService.activeLanguage()).toBe('es');
      expect((await db.profile.get(1))!.language).toBe('es');
    });

    it('bumps the data version after a successful file restore', async () => {
      const dataVersion = TestBed.inject(DataVersionService);
      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      const before = dataVersion.version();
      await service.restoreFromSnapshot(snapshot);

      expect(dataVersion.version()).toBe(before + 1);
    });

    it('applies the restored language before bumping the data version', async () => {
      const dataVersion = TestBed.inject(DataVersionService);
      const languageService = TestBed.inject(LanguageService);
      await languageService.init();

      const applySpy = vi.spyOn(languageService, 'applyFromProfile');
      const bumpSpy = vi.spyOn(dataVersion, 'bump');
      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [
          { id: 1, baseCurrency: 'EUR', language: 'es', onboardingCompleted: true, lastBackupAt: null },
        ],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      await service.restoreFromSnapshot(snapshot);

      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(bumpSpy).toHaveBeenCalledTimes(1);
      expect(applySpy.mock.invocationCallOrder[0]).toBeLessThan(
        bumpSpy.mock.invocationCallOrder[0],
      );
    });

    it('refreshes the last-backup status from the restored profile immediately', async () => {
      const snapshot: BackupSnapshot = {
        accounts: [],
        categories: [],
        transactions: [],
        transfers: [],
        profile: [
          { id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: '2026-08-27T10:00:00.000Z' },
        ],
        exportedAt: '2026-08-27T00:00:00.000Z',
      };

      await service.restoreFromSnapshot(snapshot);

      expect(service.lastBackupAt()).toBeInstanceOf(Date);
      expect(service.lastBackupAt()!.getTime()).toBe(new Date('2026-08-27T10:00:00.000Z').getTime());
    });

    it('does not bump the data version when the file restore fails', async () => {
      const dataVersion = TestBed.inject(DataVersionService);
      const file = new File([JSON.stringify({ foo: 'bar' })], 'backup.json', {
        type: 'application/json',
      });

      await expect(service.restoreFromFile(file)).rejects.toThrow();
      expect(dataVersion.version()).toBe(0);
    });
  });

  describe('manual-only backups', () => {
    it('should not trigger a backup when the tab is hidden', async () => {
      await connectAsTestUser(service);

      const spy = vi.spyOn(service, 'backupNow');
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 0));

      expect(spy).not.toHaveBeenCalled();
    });

    it('should not keep an auto-backup timer', () => {
      expect((service as any).autoBackupTimer).toBeUndefined();
      expect((service as any).scheduleAutoBackup).toBeUndefined();
    });
  });

  describe('lastBackupAt persistence', () => {
    it('should load lastBackupAt from profile on init', async () => {
      const now = new Date();
      await profileService.updateLastBackupAt(now);

      const profile = await profileService.get();
      expect(profile?.lastBackupAt).toBeTruthy();

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({}).compileComponents();
      const freshService = TestBed.inject(DriveBackupService);
      await new Promise((r) => setTimeout(r, 500));

      expect(freshService.lastBackupAt()).not.toBeNull();
      expect(freshService.lastBackupAt()?.getTime()).toBe(now.getTime());
    });
  });
});

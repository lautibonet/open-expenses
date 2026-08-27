import { TestBed } from '@angular/core/testing';
import { DriveBackupService } from './drive-backup.service';
import { ProfileService } from './profile.service';
import { NetworkService } from './network.service';
import { AccountService } from './account.service';
import { CategoryService } from './category.service';
import { TransactionService } from './transaction.service';
import { TransferService } from './transfer.service';
import { db } from '../db/database';
import { BackupSnapshot } from '../../backup/backup-snapshot';

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

      await expect(service.backupNow()).rejects.toThrow('Cannot backup while offline');
      expect(service.isConnected()).toBe(false);
    });

    it('should create a backup inside the Open Expenses folder', async () => {
      await connectAsTestUser(service);

      await accountService.create('Cash', 'EUR', 10000);
      await categoryService.create('Food', 'Expense');

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
      await expect(service.restore()).rejects.toThrow('Not connected');
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
        categories: [{ id: 1, name: 'Food', type: 'Expense', active: true, createdAt: new Date().toISOString() }],
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

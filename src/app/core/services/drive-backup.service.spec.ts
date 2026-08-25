import { TestBed } from '@angular/core/testing';
import { DriveBackupService, DriveBackupSnapshot } from './drive-backup.service';
import { ProfileService } from './profile.service';
import { AccountService } from './account.service';
import { CategoryService } from './category.service';
import { TransactionService } from './transaction.service';
import { TransferService } from './transfer.service';
import { db } from '../db/database';

function mockGoogleCodeClient() {
  const configStore: any[] = [];

  (globalThis as any).google = {
    accounts: {
      oauth2: {
        initCodeClient: vi.fn((config: any) => {
          configStore.push(config);
          return {
            requestCode: vi.fn(() => {
              if (config.callback) {
                config.callback({ code: 'auto-code' });
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

async function connectAsTestUser(
  service: DriveBackupService,
  client: ReturnType<typeof mockGoogleCodeClient>,
  token = 'test-token',
) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: token, expires_in: 3600 }),
    } as Response),
  );

  service.connect().catch(() => {});
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

function mockFetchSequence(responses: ((url: string, init?: RequestInit) => any)[]) {
  let callIndex = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const handler = responses[Math.min(callIndex, responses.length - 1)];
      callIndex++;
      const result = handler(url, init);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(result),
        text: () => Promise.resolve(JSON.stringify(result)),
        status: 200,
        statusText: 'OK',
      } as Response);
    }),
  );
}

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
    service?.cancelAutoBackup();
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
    it('should call Google Identity Services initCodeClient', async () => {
      mockGoogleCodeClient();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ access_token: 'x', expires_in: 3600 }),
        } as Response),
      );
      const p = service.connect();
      p.catch(() => {});
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      await p.catch(() => {});

      expect((globalThis as any).google.accounts.oauth2.initCodeClient).toHaveBeenCalled();
    });

    it('should set connected to true after successful auth', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      expect(service.isConnected()).toBe(true);
    });

    it('should store token in localStorage', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      const stored = localStorage.getItem('open-expenses_google_token');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.accessToken).toBe('test-token');
    });

    it('should set error if OAuth returns error', async () => {
      const client = mockGoogleCodeClient();

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
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      mockFetchSequence([() => ({})]);
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
    });

    it('should remove token from localStorage', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      mockFetchSequence([() => ({})]);
      await service.disconnect();

      expect(localStorage.getItem('open-expenses_google_token')).toBeNull();
    });

    it('should cancel auto-backup timer', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      service.scheduleAutoBackup();
      mockFetchSequence([() => ({})]);
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('backupNow', () => {
    it('should throw if not connected', async () => {
      await expect(service.backupNow()).rejects.toThrow('Not connected');
    });

    it('should create a backup on Drive', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      await accountService.create('Cash', 'EUR', 10000);
      const category = await categoryService.create('Food', 'Expense');
      const accounts = await accountService.getAll();
      await transactionService.create(accounts[0].id!, category.id!, 500, new Date(), 'January', ['groceries']);

      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ files: [] }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'file-id-1' }),
          } as Response);
        }),
      );

      await service.backupNow();

      expect(service.isBackingUp()).toBe(false);
      expect(service.lastBackupAt()).toBeInstanceOf(Date);
    });

    it('should update existing file if backup already exists', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      await accountService.create('Cash', 'EUR', 0);

      let urls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          urls.push(url);
          if (urls.length === 1) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ files: [{ id: 'existing-file-id' }] }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'existing-file-id' }),
          } as Response);
        }),
      );

      await service.backupNow();

      expect(urls[1]).toContain('existing-file-id');
    });

    it('should set error on upload failure', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

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
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      mockFetchSequence([() => ({ files: [] })]);

      await expect(service.restore()).rejects.toThrow('No backup found');
    });

    it('should overwrite local IndexedDB with backup data', async () => {
      const client = mockGoogleCodeClient();
      await connectAsTestUser(service, client);

      const snapshot: DriveBackupSnapshot = {
        accounts: [{ id: 1, name: 'Restored Cash', currency: 'EUR', initialBalance: 5000, active: true, createdAt: new Date().toISOString() }],
        categories: [{ id: 1, name: 'Food', type: 'Expense', active: true, createdAt: new Date().toISOString() }],
        transactions: [],
        transfers: [],
        profile: [{ id: 1, baseCurrency: 'EUR', onboardingCompleted: true, lastBackupAt: null }],
        exportedAt: new Date().toISOString(),
      };

      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ files: [{ id: 'backup-file-id' }] }),
            } as Response);
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(snapshot),
          } as Response);
        }),
      );

      await service.restore();

      const accounts = await db.accounts.toArray();
      expect(accounts.length).toBe(1);
      expect(accounts[0].name).toBe('Restored Cash');
    });
  });

  describe('auto-backup', () => {
    it('should set a timer when scheduleAutoBackup is called', () => {
      service.scheduleAutoBackup();
      expect((service as any).autoBackupTimer).toBeDefined();
    });

    it('should clear timer when cancelAutoBackup is called', () => {
      service.scheduleAutoBackup();
      service.cancelAutoBackup();
      expect((service as any).autoBackupTimer).toBeNull();
    });

    it('should reset timer on consecutive schedule calls', () => {
      service.scheduleAutoBackup();
      const firstTimer = (service as any).autoBackupTimer;
      service.scheduleAutoBackup();
      const secondTimer = (service as any).autoBackupTimer;
      expect(firstTimer).not.toBe(secondTimer);
    });
  });

  describe('lastBackupAt persistence', () => {
    it('should load lastBackupAt from profile on init', async () => {
      const now = new Date();
      await profileService.updateLastBackupAt(now);

      const profile = await profileService.get();
      expect(profile?.lastBackupAt).toBeTruthy();

      const freshService = new DriveBackupService(profileService);
      await new Promise((r) => setTimeout(r, 500));

      expect(freshService.lastBackupAt()).not.toBeNull();
      expect(freshService.lastBackupAt()?.getTime()).toBe(now.getTime());
    });
  });
});

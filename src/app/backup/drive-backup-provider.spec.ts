import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DriveBackupProvider } from './drive-backup-provider';
import { BackupSnapshot } from './backup-snapshot';

function jsonResponse(value: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(value),
    text: () => Promise.resolve(JSON.stringify(value)),
  } as unknown as Response;
}

function snapshot(): BackupSnapshot {
  return {
    accounts: [],
    categories: [],
    transactions: [],
    transfers: [],
    profile: [],
    exportedAt: '2026-08-27T00:00:00.000Z',
  };
}

describe('DriveBackupProvider', () => {
  let provider: DriveBackupProvider;
  let token: string | null;

  beforeEach(() => {
    token = 'test-token';
    provider = new DriveBackupProvider(() => token);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('declares its folder', () => {
    it('uses "Open Expenses" as its backup folder', () => {
      expect(provider.backupFolderName).toBe('Open Expenses');
      expect(provider.method).toBe('Google Drive');
    });
  });

  describe('saveSnapshot', () => {
    it('creates the folder when missing, then uploads the file into it', async () => {
      const urls: string[] = [];
      const bodies: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
          urls.push(url);
          if (url.includes('Expenses')) {
            return jsonResponse({ files: [] });
          }
          if (url.includes('/files?fields=id') && init?.method === 'POST') {
            bodies.push(String(init.body));
            return jsonResponse({ id: 'folder-1' });
          }
          if (url.includes('open-expenses-backup.json')) {
            return jsonResponse({ files: [] });
          }
          return jsonResponse({ id: 'file-1' });
        }),
      );

      await provider.saveSnapshot(snapshot());

      const folderCreate = bodies.find((b) => b.includes('Open Expenses'));
      expect(folderCreate).toBeTruthy();
      expect(folderCreate).toContain('application/vnd.google-apps.folder');

      const upload = urls.find((u) => u.includes('upload/drive/v3/files?uploadType=multipart'));
      expect(upload).toBeTruthy();
      expect(urls.some((u) => u.includes('open-expenses-backup.json'))).toBe(true);

      const folderSearch = urls.find((u) => u.includes('Expenses') && u.includes('/files?q='));
      expect(folderSearch).toBeTruthy();
      expect(folderSearch).toContain('in%20parents');
      expect(folderSearch).toContain('root');
    });

    it('reuses the existing folder and updates the existing file', async () => {
      const urls: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
          urls.push(url);
          if (url.includes('Expenses')) {
            return jsonResponse({ files: [{ id: 'folder-1' }] });
          }
          if (url.includes('open-expenses-backup.json')) {
            return jsonResponse({ files: [{ id: 'file-1' }] });
          }
          return jsonResponse({ id: 'file-1' });
        }),
      );

      await provider.saveSnapshot(snapshot());

      const updates = urls.filter((u) => u.includes('PATCH') || u.includes('upload/drive/v3/files/file-1?'));
      expect(updates.length).toBeGreaterThan(0);
      expect(urls.some((u) => u.includes('open-expenses-backup.json'))).toBe(true);
    });
  });

  describe('downloadSnapshot', () => {
    it('returns the snapshot when a backup file exists in the folder', async () => {
      const payload = snapshot();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async (url: string) => {
          if (url.includes('Expenses')) {
            return jsonResponse({ files: [{ id: 'folder-1' }] });
          }
          if (url.includes('open-expenses-backup.json')) {
            return jsonResponse({ files: [{ id: 'file-1' }] });
          }
          if (url.includes('alt=media')) {
            return jsonResponse(payload);
          }
          return jsonResponse({});
        }),
      );

      const result = await provider.downloadSnapshot();
      expect(result.exportedAt).toBe(payload.exportedAt);
    });

    it('throws when no backup file exists', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async (url: string) => {
          if (url.includes('Expenses')) {
            return jsonResponse({ files: [{ id: 'folder-1' }] });
          }
          return jsonResponse({ files: [] });
        }),
      );

      await expect(provider.downloadSnapshot()).rejects.toThrow('No backup found');
    });
  });
});

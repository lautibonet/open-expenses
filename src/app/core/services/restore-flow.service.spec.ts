import { TestBed } from '@angular/core/testing';
import { RestoreFlow } from './restore-flow.service';
import { DriveBackupService } from './drive-backup.service';
import { BackupSnapshot } from '../../backup/backup-snapshot';
import { NoBackupFoundError } from '../../backup/drive-backup-provider';
import { TranslationError } from '../models/translation-error';

function snapshot(exportedAt = '2026-08-27T00:00:00.000Z'): BackupSnapshot {
  return {
    accounts: [],
    categories: [],
    transactions: [],
    transfers: [],
    profile: [],
    exportedAt,
  };
}

describe('RestoreFlow', () => {
  let flow: RestoreFlow;
  let restoreFromSnapshot: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    restoreFromSnapshot = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: DriveBackupService, useValue: { restoreFromSnapshot } }],
    });
    flow = TestBed.inject(RestoreFlow);
  });

  it('turns a fetched snapshot into the Pending Restore', async () => {
    const fetched = snapshot();

    const outcome = await flow.fetch(async () => fetched);

    expect(outcome).toEqual({ kind: 'pending' });
    expect(flow.pending()).toBe(fetched);
  });

  it('drops an earlier Pending Restore when a new fetch fails', async () => {
    await flow.fetch(async () => snapshot());

    const outcome = await flow.fetch(async () => {
      throw new NoBackupFoundError();
    });

    expect(outcome).toEqual({ kind: 'failed', key: 'backup.noCloudBackup' });
    expect(flow.pending()).toBeNull();
  });

  it('reports a closed sign-in window as a Cancelled Restore', async () => {
    const outcome = await flow.fetch(async () => {
      throw new TranslationError('backup.error.oauth.cancelled');
    });

    expect(outcome).toEqual({ kind: 'cancelled', key: 'backup.error.oauth.cancelled' });
    expect(flow.pending()).toBeNull();
  });

  it('is restoring only while a fetch is in flight', async () => {
    let release!: (s: BackupSnapshot) => void;
    const fetching = flow.fetch(() => new Promise((resolve) => (release = resolve)));

    expect(flow.restoring()).toBe(true);
    release(snapshot());
    await fetching;
    expect(flow.restoring()).toBe(false);
  });

  it('confirming overwrites local data with the Pending Restore and settles it', async () => {
    const fetched = snapshot();
    await flow.fetch(async () => fetched);

    const outcome = await flow.confirm();

    expect(outcome).toEqual({ kind: 'restored' });
    expect(restoreFromSnapshot).toHaveBeenCalledWith(fetched);
    expect(flow.pending()).toBeNull();
  });

  it('keeps the Pending Restore when the overwrite fails, so the user can retry', async () => {
    const fetched = snapshot();
    await flow.fetch(async () => fetched);
    restoreFromSnapshot.mockRejectedValue(new Error('disk full'));

    const outcome = await flow.confirm();

    expect(outcome).toEqual({ kind: 'failed', key: 'backup.error.restoreFailed' });
    expect(flow.pending()).toBe(fetched);
    expect(flow.restoring()).toBe(false);
  });

  it('does nothing when confirming with no Pending Restore', async () => {
    expect(await flow.confirm()).toBeNull();
    expect(restoreFromSnapshot).not.toHaveBeenCalled();
  });

  it('declining the Pending Restore leaves local data untouched', async () => {
    await flow.fetch(async () => snapshot());

    flow.decline();

    expect(flow.pending()).toBeNull();
    expect(restoreFromSnapshot).not.toHaveBeenCalled();
  });
});

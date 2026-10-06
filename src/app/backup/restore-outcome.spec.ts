import { describe, it, expect } from 'vitest';
import { restoreOutcomeOf } from './restore-outcome';
import { NoBackupFoundError } from './drive-backup-provider';
import { NewerBackupVersionError } from './backup-snapshot';
import { TranslationError } from '../core/models/translation-error';

describe('restoreOutcomeOf', () => {
  it('treats a closed sign-in window as a Cancelled Restore', () => {
    expect(restoreOutcomeOf(new TranslationError('backup.error.oauth.cancelled'))).toEqual({
      kind: 'cancelled',
      key: 'backup.error.oauth.cancelled',
    });
  });

  it('treats declined access as a Cancelled Restore', () => {
    expect(restoreOutcomeOf(new TranslationError('backup.error.oauth.denied'))).toEqual({
      kind: 'cancelled',
      key: 'backup.error.oauth.denied',
    });
  });

  it('treats a blocked sign-in window as a failed Restore', () => {
    expect(restoreOutcomeOf(new TranslationError('backup.error.oauth.popupBlocked'))).toEqual({
      kind: 'failed',
      key: 'backup.error.oauth.popupBlocked',
    });
  });

  it('treats a sign-in that could not load as a failed Restore', () => {
    expect(restoreOutcomeOf(new TranslationError('backup.error.oauth.loadFailed'))).toEqual({
      kind: 'failed',
      key: 'backup.error.oauth.loadFailed',
    });
  });

  it('reports a missing cloud Backup as a failure with its own copy', () => {
    expect(restoreOutcomeOf(new NoBackupFoundError())).toEqual({
      kind: 'failed',
      key: 'backup.noCloudBackup',
    });
  });

  it('reports a Backup from a newer app version', () => {
    expect(restoreOutcomeOf(new NewerBackupVersionError())).toEqual({
      kind: 'failed',
      key: 'backup.error.newerVersion',
    });
  });

  it('keeps the key and params of any other translated error', () => {
    expect(restoreOutcomeOf(new TranslationError('backup.error.offlineRestore', { n: 1 }))).toEqual({
      kind: 'failed',
      key: 'backup.error.offlineRestore',
      params: { n: 1 },
    });
  });

  it('falls back to the generic Restore failure for anything else', () => {
    expect(restoreOutcomeOf(new Error('Failed to fetch'))).toEqual({
      kind: 'failed',
      key: 'backup.error.restoreFailed',
    });
    expect(restoreOutcomeOf('boom')).toEqual({
      kind: 'failed',
      key: 'backup.error.restoreFailed',
    });
  });
});

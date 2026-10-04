import { TranslationError } from '../core/models/translation-error';
import { NoBackupFoundError } from './drive-backup-provider';
import { NewerBackupVersionError } from './backup-snapshot';

/** A Cancelled Restore: the user backed out; `key` is the neutral info line. */
export interface RestoreCancelled {
  kind: 'cancelled';
  key: string;
}

export interface RestoreFailed {
  kind: 'failed';
  key: string;
  params?: Record<string, string | number>;
}

/* Only the user backing out cancels a Restore. A blocked sign-in window or a
   sign-in that could not load happened to the user: that Restore failed. */
const CANCELLED_KEYS = new Set(['backup.error.oauth.cancelled', 'backup.error.oauth.denied']);

/** Maps anything a Restore attempt threw to the outcome every entry point shows. */
export function restoreOutcomeOf(e: unknown): RestoreCancelled | RestoreFailed {
  if (e instanceof NoBackupFoundError) {
    return { kind: 'failed', key: 'backup.noCloudBackup' };
  }
  if (e instanceof NewerBackupVersionError) {
    return { kind: 'failed', key: 'backup.error.newerVersion' };
  }
  if (e instanceof TranslationError) {
    if (CANCELLED_KEYS.has(e.key)) {
      return { kind: 'cancelled', key: e.key };
    }
    return e.params
      ? { kind: 'failed', key: e.key, params: e.params }
      : { kind: 'failed', key: e.key };
  }
  return { kind: 'failed', key: 'backup.error.restoreFailed' };
}

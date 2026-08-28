export interface BackupErrorCopy {
  text: string;
  code: string | null;
}

const OAUTH_COPY: Record<string, string> = {
  popup_closed_by_user: 'Google sign-in was cancelled — try again when you are ready.',
  access_denied: 'Google sign-in was declined — Open Expenses needs Drive access to back up.',
  popup_failed_to_open: 'Google sign-in could not open — allow popups for this site and try again.',
  idpiframe_initialization_failed:
    'Google sign-in could not load — check your connection, or allow third-party cookies for accounts.google.com.',
};

const PROVIDER_COPY: Record<string, string> = {
  'Failed to load Google Identity Services':
    'Google sign-in could not load — check your connection and try again.',
  'Failed to fetch': 'Could not reach Google Drive — check your connection and try again.',
  'Failed to search Drive': 'Could not reach Google Drive — check your connection and try again.',
  'Failed to create backup folder': 'Could not create the backup folder in Google Drive — try again.',
  'Failed to create backup file': 'Could not save the backup to Google Drive — try again.',
  'Failed to update backup file': 'Could not update the backup in Google Drive — try again.',
  'Failed to download backup': 'Could not download the backup from Google Drive — try again.',
  'Backup failed': 'The backup failed — try again.',
  'Restore failed': 'The restore failed — try again.',
};

const GENERIC_COPY = 'The backup failed unexpectedly — try again.';

export function describeBackupError(raw: string): BackupErrorCopy {
  const oauth = OAUTH_COPY[raw];
  if (oauth) {
    return { text: oauth, code: raw };
  }

  const provider = PROVIDER_COPY[raw];
  if (provider) {
    return { text: provider, code: null };
  }

  if (/^[a-z0-9_]+$/i.test(raw)) {
    return { text: GENERIC_COPY, code: raw };
  }

  return { text: raw, code: null };
}

import { Language } from '../core/types/language.type';
import { translate } from '../core/translations/translations';

export interface BackupErrorCopy {
  text: string;
  code: string | null;
}

const OAUTH_COPY: Record<string, string> = {
  popup_closed_by_user: 'backup.error.oauth.cancelled',
  popup_closed: 'backup.error.oauth.cancelled',
  access_denied: 'backup.error.oauth.denied',
  popup_failed_to_open: 'backup.error.oauth.popupBlocked',
  idpiframe_initialization_failed: 'backup.error.oauth.loadFailed',
};

export function oauthErrorKey(code: string | undefined): string {
  return OAUTH_COPY[code ?? ''] ?? 'backup.error.unexpected';
}

const RAW_COPY: Record<string, string> = {
  'Failed to fetch': 'backup.error.driveUnreachable',
};

const GENERIC_KEY = 'backup.error.unexpected';

export function describeBackupError(raw: string, language: Language): BackupErrorCopy {
  const oauthKey = OAUTH_COPY[raw];
  if (oauthKey) {
    return { text: translate(language, oauthKey), code: raw };
  }

  const rawKey = RAW_COPY[raw];
  if (rawKey) {
    return { text: translate(language, rawKey), code: null };
  }

  if (/^[a-z0-9_]+$/i.test(raw)) {
    return { text: translate(language, GENERIC_KEY), code: raw };
  }

  return { text: raw, code: null };
}

import { Language } from '../core/types/language.type';
import { translate } from '../core/translations/translations';
import { formatRelativeTimeIn } from '../core/format/relative-time';

export function formatLastBackupStatus(
  language: Language,
  lastBackupAt: Date | null,
  method?: string,
): string {
  const when = lastBackupAt
    ? formatRelativeTimeIn(language, lastBackupAt)
    : translate(language, 'backup.status.never');
  const status = translate(language, 'backup.status.lastBackup', { when });
  return lastBackupAt && method ? `${method} · ${status}` : status;
}

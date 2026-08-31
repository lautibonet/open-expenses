import { Language, localeFor } from '../types/language.type';
import { translate } from '../translations/translations';
import { formatDateIn } from './format';

export function formatRelativeTimeIn(language: Language, date: Date, now: Date = new Date()): string {
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMin < 1) {
    return translate(language, 'backup.relative.justNow');
  }

  const rtf = new Intl.RelativeTimeFormat(localeFor(language), { numeric: 'auto' });
  if (diffMin < 60) {
    return rtf.format(-diffMin, 'minute');
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return rtf.format(-diffHr, 'hour');
  }
  if (diffHr < 48) {
    return rtf.format(-1, 'day');
  }

  return formatDateIn(language, date, { month: 'short', day: 'numeric' });
}

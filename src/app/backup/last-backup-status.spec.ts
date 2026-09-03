import { describe, it, expect } from 'vitest';
import { formatLastBackupStatus } from './last-backup-status';

describe('formatLastBackupStatus', () => {
  const at = new Date(Date.now() - 5 * 60 * 1000);

  it('shows the method with the relative last-backup time', () => {
    expect(formatLastBackupStatus('en', at, 'Google Drive')).toBe(
      'Google Drive · Last backup: 5 minutes ago',
    );
  });

  it('omits the method before the first backup', () => {
    expect(formatLastBackupStatus('en', null, 'Google Drive')).toBe('Last backup: Never');
  });

  it('renders in Spanish', () => {
    expect(formatLastBackupStatus('es', at, 'Google Drive')).toBe(
      'Google Drive · Última copia: hace 5 minutos',
    );
    expect(formatLastBackupStatus('es', null, 'Google Drive')).toBe('Última copia: Nunca');
  });
});

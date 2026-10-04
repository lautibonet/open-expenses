import { Injectable, inject, signal } from '@angular/core';
import { ProfileService } from './profile.service';
import { NetworkService } from './network.service';
import { LanguageService } from './language.service';
import { DataVersionService } from './data-version.service';
import { BackupProvider } from '../../backup/backup-provider';
import { DriveBackupProvider, NoBackupFoundError } from '../../backup/drive-backup-provider';
import { oauthErrorKey } from '../../backup/backup-errors';
import { TranslationError } from '../models/translation-error';
import {
  BackupSnapshot,
  NewerBackupVersionError,
  createSnapshot,
  isBackupSnapshotShape,
  overwriteLocalDb,
  parseSnapshot,
} from '../../backup/backup-snapshot';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class DriveBackupService {
  private readonly TOKEN_KEY = 'open-expenses_google_token';
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive.file';

  private profileService = inject(ProfileService);
  private networkService = inject(NetworkService);
  private languageService = inject(LanguageService);
  private dataVersion = inject(DataVersionService);

  private provider: BackupProvider;

  isConnected = signal(false);
  isBackingUp = signal(false);
  lastBackupAt = signal<Date | null>(null);
  /** The last Backup error; Restore errors travel through their own outcome instead. */
  error = signal<TranslationError | Error | string | null>(null);

  private accessToken: string | null = null;

  constructor() {
    this.provider = new DriveBackupProvider(() => this.accessToken);
    this.loadStoredState();
  }

  get method(): string {
    return this.provider.method;
  }

  clearError(): void {
    this.error.set(null);
  }

  private asBackupError(fallbackKey: string, e: unknown): Error {
    return e instanceof NewerBackupVersionError
      ? new TranslationError('backup.error.newerVersion')
      : e instanceof Error
        ? e
        : new TranslationError(fallbackKey);
  }

  /** Backup failures are recorded in `error`, which carries Backup errors only. */
  private setAndRethrow(fallbackKey: string, e: unknown): never {
    const err = this.asBackupError(fallbackKey, e);
    this.error.set(err);
    throw err;
  }

  /**
   * Signs in to the Backup Method. A failure rejects with its translated copy
   * and is left for the caller to record: a Backup records it as the Backup
   * error, a Restore reports it through its own outcome.
   */
  async connect(): Promise<void> {
    if (!this.networkService.isOnline()) {
      throw new TranslationError('backup.error.offlineConnect');
    }

    await this.loadGoogleIdentityServices();

    const g = (globalThis as any).google;
    return new Promise<void>((resolve, reject) => {
      const client = g.accounts.oauth2.initTokenClient({
        client_id: this.getClientId(),
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new TranslationError(oauthErrorKey(response.error)));
            return;
          }
          this.accessToken = response.access_token;
          this.storeToken(response.access_token, response.expires_in);
          this.isConnected.set(true);
          resolve();
        },
        error_callback: (oauthError: { type?: string }) => {
          const type = oauthError?.type ?? 'popup_closed';
          reject(new TranslationError(oauthErrorKey(type)));
        },
      });
      client.requestAccessToken();
    });
  }

  /** Local-only token removal for Erase: no server revoke, just forget the sign-in. */
  clearStoredToken(): void {
    this.accessToken = null;
    localStorage.removeItem(this.TOKEN_KEY);
    this.isConnected.set(false);
  }

  async disconnect(): Promise<void> {
    if (this.accessToken) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${this.accessToken}`,
          { method: 'POST' },
        );
      } catch {
        // Revoke is best-effort
      }
    }

    this.accessToken = null;
    localStorage.removeItem(this.TOKEN_KEY);
    this.isConnected.set(false);
  }

  async backupNow(): Promise<void> {
    if (!this.networkService.isOnline()) {
      throw new TranslationError('backup.error.offlineBackup');
    }

    if (this.isBackingUp()) {
      return;
    }

    this.isBackingUp.set(true);
    this.error.set(null);

    try {
      if (!this.accessToken) {
        await this.connect();
      }

      const snapshot = await createSnapshot();
      await this.provider.saveSnapshot(snapshot);

      const now = new Date();
      this.lastBackupAt.set(now);
      await this.profileService.updateLastBackupAt(now);
    } catch (e: unknown) {
      this.setAndRethrow('backup.error.backupFailed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  async restore(): Promise<void> {
    if (!this.accessToken) {
      throw new TranslationError('backup.error.notConnected');
    }

    if (!this.networkService.isOnline()) {
      throw new TranslationError('backup.error.offlineRestore');
    }

    this.isBackingUp.set(true);

    try {
      const snapshot = await this.provider.downloadSnapshot();
      await this.applyRestoredSnapshot(snapshot);
    } catch (e: unknown) {
      throw this.asBackupError('backup.error.restoreFailed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  async getCloudSnapshot(): Promise<BackupSnapshot> {
    if (!this.networkService.isOnline()) {
      throw new TranslationError('backup.error.offlineRestore');
    }

    if (this.isBackingUp()) {
      throw new TranslationError('backup.error.alreadyInProgress');
    }

    this.isBackingUp.set(true);

    try {
      if (!this.accessToken) {
        await this.connect();
      }

      return await this.provider.downloadSnapshot();
    } catch (e: unknown) {
      throw this.asBackupError('backup.error.restoreFailed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  async parseBackupFile(file: File): Promise<BackupSnapshot> {
    const json = await file.text();

    let snapshot: BackupSnapshot;
    try {
      snapshot = parseSnapshot(json);
    } catch {
      throw new TranslationError('backup.error.invalidFile');
    }

    if (!isBackupSnapshotShape(snapshot)) {
      throw new TranslationError('backup.error.invalidFile');
    }

    return snapshot;
  }

  async restoreFromSnapshot(snapshot: BackupSnapshot): Promise<void> {
    this.isBackingUp.set(true);

    try {
      await this.applyRestoredSnapshot(snapshot);
    } catch (e: unknown) {
      throw this.asBackupError('backup.error.restoreFailed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  /** Shared success path for every Restore: overwrite, stamp Last Backup, apply language, notify listeners. */
  private async applyRestoredSnapshot(snapshot: BackupSnapshot): Promise<void> {
    await overwriteLocalDb(snapshot);
    /* The Last Backup figure answers "how fresh is the data I'm holding":
       it must reflect when the restored snapshot itself was taken, not the
       source device's mirrored profile value, which lags behind that
       device's final backup (the snapshot is created before it updates its
       own lastBackupAt). A snapshot with an unparsable export time (only
       possible from a hand-edited file) falls back to the restored profile. */
    const takenAt = new Date(snapshot.exportedAt);
    if (Number.isNaN(takenAt.getTime())) {
      await this.refreshLastBackupStatus();
    } else {
      this.lastBackupAt.set(takenAt);
      await this.profileService.updateLastBackupAt(takenAt);
    }
    await this.languageService.applyFromProfile();
    this.dataVersion.bump();
  }

  private async refreshLastBackupStatus(): Promise<void> {
    const profile = await this.profileService.get();
    this.lastBackupAt.set(profile?.lastBackupAt ? new Date(profile.lastBackupAt) : null);
  }

  async restoreFromFile(file: File): Promise<void> {
    const snapshot = await this.parseBackupFile(file);
    await this.restoreFromSnapshot(snapshot);
  }

  private loadStoredState(): void {
    const stored = localStorage.getItem(this.TOKEN_KEY);
    if (stored) {
      try {
        const parsed: StoredToken = JSON.parse(stored);
        if (parsed.expiresAt > Date.now()) {
          this.accessToken = parsed.accessToken;
          this.isConnected.set(true);
        } else {
          localStorage.removeItem(this.TOKEN_KEY);
        }
      } catch {
        localStorage.removeItem(this.TOKEN_KEY);
      }
    }

    this.profileService.get().then((profile) => {
      if (profile?.lastBackupAt) {
        this.lastBackupAt.set(new Date(profile.lastBackupAt));
      }
    });
  }

  private storeToken(accessToken: string, expiresIn: number): void {
    const stored: StoredToken = {
      accessToken,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(stored));
  }

  private getClientId(): string {
    return (
      (document.querySelector('meta[name="google-client-id"]') as HTMLMetaElement)
        ?.content ?? ''
    );
  }

  private loadGoogleIdentityServices(): Promise<void> {
    const g = (globalThis as any).google;
    if (g?.accounts?.oauth2) {
      return Promise.resolve();
    }

    if (typeof document === 'undefined') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new TranslationError('backup.error.loadIdentity'));
      document.head.appendChild(script);
    });
  }
}

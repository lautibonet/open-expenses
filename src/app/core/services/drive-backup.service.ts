import { Injectable, inject, signal } from '@angular/core';
import { ProfileService } from './profile.service';
import { NetworkService } from './network.service';
import { LanguageService } from './language.service';
import { BackupProvider } from '../../backup/backup-provider';
import { DriveBackupProvider } from '../../backup/drive-backup-provider';
import {
  BackupSnapshot,
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

  private provider: BackupProvider;

  isConnected = signal(false);
  isBackingUp = signal(false);
  lastBackupAt = signal<Date | null>(null);
  error = signal<string | null>(null);

  private accessToken: string | null = null;

  constructor() {
    this.provider = new DriveBackupProvider(
      () => this.accessToken,
      (key) => this.languageService.t(key),
    );
    this.loadStoredState();
  }

  get method(): string {
    return this.provider.method;
  }

  clearError(): void {
    this.error.set(null);
  }

  private setAndRethrow(fallbackKey: string, e: unknown): never {
    const message = e instanceof Error ? e.message : this.languageService.t(fallbackKey);
    this.error.set(message);
    throw e;
  }

  async connect(): Promise<void> {
    this.error.set(null);

    if (!this.networkService.isOnline()) {
      const msg = this.languageService.t('backup.error.offlineConnect');
      this.error.set(msg);
      throw new Error(msg);
    }

    await this.loadGoogleIdentityServices();

    const g = (globalThis as any).google;
    return new Promise<void>((resolve, reject) => {
      const client = g.accounts.oauth2.initTokenClient({
        client_id: this.getClientId(),
        scope: this.SCOPES,
        callback: (response: any) => {
          if (response.error) {
            this.error.set(response.error);
            reject(new Error(response.error));
            return;
          }
          this.accessToken = response.access_token;
          this.storeToken(response.access_token, response.expires_in);
          this.isConnected.set(true);
          resolve();
        },
      });
      client.requestAccessToken();
    });
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
      throw new Error(this.languageService.t('backup.error.offlineBackup'));
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
      throw new Error(this.languageService.t('backup.error.notConnected'));
    }

    if (!this.networkService.isOnline()) {
      throw new Error(this.languageService.t('backup.error.offlineRestore'));
    }

    this.isBackingUp.set(true);
    this.error.set(null);

    try {
      const snapshot = await this.provider.downloadSnapshot();
      await overwriteLocalDb(snapshot);
      await this.languageService.applyFromProfile();
    } catch (e: unknown) {
      this.setAndRethrow('backup.error.restoreFailed', e);
    } finally {
      this.isBackingUp.set(false);
    }
  }

  async getCloudSnapshot(): Promise<BackupSnapshot> {
    if (!this.networkService.isOnline()) {
      throw new Error(this.languageService.t('backup.error.offlineRestore'));
    }

    if (this.isBackingUp()) {
      throw new Error(this.languageService.t('backup.error.alreadyInProgress'));
    }

    this.isBackingUp.set(true);
    this.error.set(null);

    try {
      if (!this.accessToken) {
        await this.connect();
      }

      return await this.provider.downloadSnapshot();
    } catch (e: unknown) {
      this.setAndRethrow('backup.error.restoreFailed', e);
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
      throw new Error(this.languageService.t('backup.error.invalidFile'));
    }

    if (!isBackupSnapshotShape(snapshot)) {
      throw new Error(this.languageService.t('backup.error.invalidFile'));
    }

    return snapshot;
  }

  async restoreFromSnapshot(snapshot: BackupSnapshot): Promise<void> {
    this.isBackingUp.set(true);
    this.error.set(null);

    try {
      await overwriteLocalDb(snapshot);
      await this.languageService.applyFromProfile();
    } catch (e: unknown) {
      this.setAndRethrow('backup.error.restoreFailed', e);
    } finally {
      this.isBackingUp.set(false);
    }
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
      script.onerror = () => reject(new Error(this.languageService.t('backup.error.loadIdentity')));
      document.head.appendChild(script);
    });
  }
}

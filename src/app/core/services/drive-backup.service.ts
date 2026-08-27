import { Injectable, inject, signal } from '@angular/core';
import { ProfileService } from './profile.service';
import { NetworkService } from './network.service';
import { BackupProvider } from '../../backup/backup-provider';
import { DriveBackupProvider } from '../../backup/drive-backup-provider';
import { createSnapshot, overwriteLocalDb } from '../../backup/backup-snapshot';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class DriveBackupService {
  private readonly TOKEN_KEY = 'open-expenses_google_token';
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive.file';
  private readonly DEBOUNCE_MS = 5 * 60 * 1000;

  private profileService = inject(ProfileService);
  private networkService = inject(NetworkService);

  private provider: BackupProvider;

  isConnected = signal(false);
  isBackingUp = signal(false);
  lastBackupAt = signal<Date | null>(null);
  error = signal<string | null>(null);

  private autoBackupTimer: ReturnType<typeof setTimeout> | null = null;
  private accessToken: string | null = null;

  constructor() {
    this.provider = new DriveBackupProvider(() => this.accessToken);
    this.loadStoredState();
    this.setupVisibilityListener();
  }

  async connect(): Promise<void> {
    this.error.set(null);

    if (!this.networkService.isOnline()) {
      const msg = 'Cannot connect while offline';
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
    this.cancelAutoBackup();

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
    if (!this.accessToken) {
      throw new Error('Not connected');
    }

    if (!this.networkService.isOnline()) {
      throw new Error('Cannot backup while offline');
    }

    this.isBackingUp.set(true);
    this.error.set(null);

    try {
      const snapshot = await createSnapshot();
      await this.provider.saveSnapshot(snapshot);

      const now = new Date();
      this.lastBackupAt.set(now);
      await this.profileService.updateLastBackupAt(now);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Backup failed';
      this.error.set(message);
      throw e;
    } finally {
      this.isBackingUp.set(false);
    }
  }

  async restore(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not connected');
    }

    if (!this.networkService.isOnline()) {
      throw new Error('Cannot restore while offline');
    }

    this.isBackingUp.set(true);
    this.error.set(null);

    try {
      const snapshot = await this.provider.downloadSnapshot();
      await overwriteLocalDb(snapshot);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Restore failed';
      this.error.set(message);
      throw e;
    } finally {
      this.isBackingUp.set(false);
    }
  }

  scheduleAutoBackup(): void {
    this.cancelAutoBackup();
    if (!this.networkService.isOnline()) {
      return;
    }
    this.autoBackupTimer = setTimeout(() => {
      if (this.isConnected()) {
        this.backupNow().catch(() => {});
      }
    }, this.DEBOUNCE_MS);
  }

  cancelAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearTimeout(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
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
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }

  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.isConnected() && this.networkService.isOnline()) {
          this.backupNow().catch(() => {});
        }
      });
    }
  }
}

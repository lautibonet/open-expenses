import { Injectable, inject, signal } from '@angular/core';
import { db } from '../db/database';
import { ProfileService } from './profile.service';
import { NetworkService } from './network.service';

export interface DriveBackupSnapshot {
  accounts: any[];
  categories: any[];
  transactions: any[];
  transfers: any[];
  profile: any[];
  exportedAt: string;
}

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class DriveBackupService {
  private readonly BACKUP_FILE_NAME = 'open-expenses-backup.json';
  private readonly TOKEN_KEY = 'open-expenses_google_token';
  private readonly SCOPES = 'https://www.googleapis.com/auth/drive.file';
  private readonly DEBOUNCE_MS = 5 * 60 * 1000;

  private profileService = inject(ProfileService);
  private networkService = inject(NetworkService);

  isConnected = signal(false);
  isBackingUp = signal(false);
  lastBackupAt = signal<Date | null>(null);
  error = signal<string | null>(null);

  private autoBackupTimer: ReturnType<typeof setTimeout> | null = null;
  private accessToken: string | null = null;
  private pendingCodeVerifier: string | null = null;

  constructor() {
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

    const codeVerifier = this.generateCodeVerifier();
    this.pendingCodeVerifier = codeVerifier;
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    const g = (globalThis as any).google;
    return new Promise<void>((resolve, reject) => {
      const client = g.accounts.oauth2.initCodeClient({
        client_id: this.getClientId(),
        scope: this.SCOPES,
        ux_mode: 'popup',
        callback: async (response: any) => {
          if (response.error) {
            this.error.set(response.error);
            this.pendingCodeVerifier = null;
            reject(new Error(response.error));
            return;
          }
          try {
            const tokens = await this.exchangeCodeForTokens(
              response.code,
              codeVerifier,
            );
            this.accessToken = tokens.access_token;
            this.storeToken(tokens.access_token, tokens.expires_in);
            this.isConnected.set(true);
            resolve();
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Token exchange failed';
            this.error.set(message);
            this.pendingCodeVerifier = null;
            reject(new Error(message));
          }
        },
      });
      client.requestCode();
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
      const snapshot = await this.createSnapshot();
      const fileId = await this.findBackupFileId();

      if (fileId) {
        await this.updateFile(fileId, snapshot);
      } else {
        await this.createFile(snapshot);
      }

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
      const fileId = await this.findBackupFileId();
      if (!fileId) {
        throw new Error('No backup found');
      }

      const snapshot = await this.downloadFile(fileId);
      await this.overwriteLocalDb(snapshot);
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

  private async createSnapshot(): Promise<DriveBackupSnapshot> {
    return {
      accounts: await db.accounts.toArray(),
      categories: await db.categories.toArray(),
      transactions: await db.transactions.toArray(),
      transfers: await db.transfers.toArray(),
      profile: await db.profile.toArray(),
      exportedAt: new Date().toISOString(),
    };
  }

  private async findBackupFileId(): Promise<string | null> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${this.BACKUP_FILE_NAME}' and trashed=false&fields=files(id)`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error('Failed to search Drive');
    }

    const data = await response.json();
    return data.files?.length > 0 ? data.files[0].id : null;
  }

  private async createFile(snapshot: DriveBackupSnapshot): Promise<void> {
    const metadata = { name: this.BACKUP_FILE_NAME, mimeType: 'application/json' };
    await this.uploadFile(
      snapshot,
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      metadata,
    );
  }

  private async updateFile(fileId: string, snapshot: DriveBackupSnapshot): Promise<void> {
    await this.uploadFile(
      snapshot,
      'PATCH',
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
    );
  }

  private async downloadFile(fileId: string): Promise<DriveBackupSnapshot> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error('Failed to download backup');
    }

    return response.json();
  }

  private async overwriteLocalDb(snapshot: DriveBackupSnapshot): Promise<void> {
    const tables = [
      { table: db.accounts as any, data: snapshot.accounts },
      { table: db.categories as any, data: snapshot.categories },
      { table: db.transactions as any, data: snapshot.transactions },
      { table: db.transfers as any, data: snapshot.transfers },
      { table: db.profile as any, data: snapshot.profile },
    ];

    await db.transaction(
      'rw',
      tables.map((t) => t.table),
      async () => {
        for (const { table, data } of tables) {
          await table.clear();
          if (data?.length) await table.bulkAdd(data);
        }
      },
    );
  }

  private async uploadFile(
    snapshot: DriveBackupSnapshot,
    method: string,
    url: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([JSON.stringify(snapshot)], { type: 'application/json' }));

    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });

    if (!response.ok) {
      throw new Error(method === 'POST' ? 'Failed to create backup file' : 'Failed to update backup file');
    }
  }

  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<{ access_token: string; expires_in: number }> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.getClientId(),
        redirect_uri: window.location.origin,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      throw new Error('Token exchange failed');
    }

    return response.json();
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    for (const byte of buffer) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

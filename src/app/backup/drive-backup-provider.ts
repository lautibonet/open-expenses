import { BackupProvider } from './backup-provider';
import { BackupSnapshot, stringifySnapshot } from './backup-snapshot';
import { translate } from '../core/translations/translations';
import { DEFAULT_LANGUAGE } from '../core/types/language.type';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_MIME = 'application/json';

export class NoBackupFoundError extends Error {
  constructor(message: string = 'No backup found') {
    super(message);
    this.name = 'NoBackupFoundError';
  }
}

export class DriveBackupProvider implements BackupProvider {
  readonly method = 'Google Drive';
  readonly backupFolderName = 'Open Expenses';

  private readonly BACKUP_FILE_NAME = 'open-expenses-backup.json';
  private folderId: string | null = null;

  constructor(
    private readonly getToken: () => string | null,
    private readonly translateError: (key: string) => string = (key) =>
      translate(DEFAULT_LANGUAGE, key),
  ) {}

  async saveSnapshot(snapshot: BackupSnapshot): Promise<void> {
    const folderId = await this.ensureFolder();
    const fileId = await this.findBackupFileId(folderId);

    if (fileId) {
      await this.updateFile(fileId, snapshot);
    } else {
      await this.createFile(folderId, snapshot);
    }
  }

  async downloadSnapshot(): Promise<BackupSnapshot> {
    const folderId = await this.ensureFolder();
    const fileId = await this.findBackupFileId(folderId);
    if (!fileId) {
      throw new NoBackupFoundError(this.translateError('backup.error.noBackupFound'));
    }
    return this.downloadFile(fileId);
  }

  private async ensureFolder(): Promise<string> {
    const existing = this.folderId;
    if (existing) {
      return existing;
    }

    const response = await this.fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(
        `name='${this.backupFolderName}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`,
      )}&spaces=drive&fields=files(id,trashed)`,
    );
    const data = await response.json();
    if (data.files?.length > 0) {
      const found = data.files[0].id as string;
      this.folderId = found;
      return found;
    }

    const createResponse = await fetch(
      `${DRIVE_API}/files?fields=id`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
          'Content-Type': JSON_MIME,
        },
        body: JSON.stringify({ name: this.backupFolderName, mimeType: FOLDER_MIME }),
      },
    );
    if (!createResponse.ok) {
      throw new Error(this.translateError('backup.error.createFolder'));
    }
    const created = await createResponse.json();
    this.folderId = created.id;
    return this.folderId!;
  }

  private async findBackupFileId(folderId: string): Promise<string | null> {
    const response = await this.fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(
        `name='${this.BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
      )}&fields=files(id)`,
    );
    const data = await response.json();
    return data.files?.length > 0 ? data.files[0].id : null;
  }

  private async createFile(folderId: string, snapshot: BackupSnapshot): Promise<void> {
    const metadata = {
      name: this.BACKUP_FILE_NAME,
      mimeType: JSON_MIME,
      parents: [folderId],
    };
    await this.uploadFile(snapshot, 'POST', `${UPLOAD_API}/files?uploadType=multipart`, metadata);
  }

  private async updateFile(fileId: string, snapshot: BackupSnapshot): Promise<void> {
    await this.uploadFile(
      snapshot,
      'PATCH',
      `${UPLOAD_API}/files/${fileId}?uploadType=multipart`,
    );
  }

  private async downloadFile(fileId: string): Promise<BackupSnapshot> {
    const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
    if (!response.ok) {
      throw new Error(this.translateError('backup.error.download'));
    }
    return response.json();
  }

  private async uploadFile(
    snapshot: BackupSnapshot,
    method: string,
    url: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: JSON_MIME }));
    form.append('file', new Blob([stringifySnapshot(snapshot)], { type: JSON_MIME }));

    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: form,
    });

    if (!response.ok) {
      throw new Error(
        this.translateError(method === 'POST' ? 'backup.error.createFile' : 'backup.error.updateFile'),
      );
    }
  }

  private async fetch(url: string): Promise<Response> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
    if (!response.ok) {
      throw new Error(this.translateError('backup.error.searchDrive'));
    }
    return response;
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupBannerComponent } from './backup-banner.component';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';
import { ProfileService } from '../../../core/services/profile.service';
import { LanguageService } from '../../../core/services/language.service';
import { db } from '../../../core/db/database';

describe('BackupBannerComponent', () => {
  let fixture: ComponentFixture<BackupBannerComponent>;
  let component: BackupBannerComponent;
  let driveBackupService: DriveBackupService;
  let networkService: NetworkService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [BackupBannerComponent],
    }).compileComponents();

    const profileService = TestBed.inject(ProfileService);
    await profileService.completeOnboarding('EUR');

    fixture = TestBed.createComponent(BackupBannerComponent);
    component = fixture.componentInstance;
    driveBackupService = TestBed.inject(DriveBackupService);
    networkService = TestBed.inject(NetworkService);
    fixture.detectChanges();
  });

  afterEach(async () => {
    localStorage.clear();
    await db.delete();
  });

  it('shows the backup method', () => {
    expect(fixture.nativeElement.textContent).toContain('Google Drive');
  });

  it('shows Never before the first backup', () => {
    expect(fixture.nativeElement.textContent).toContain('Never');
  });

  it('shows the relative last-backup time', () => {
    driveBackupService.lastBackupAt.set(new Date(Date.now() - 5 * 60 * 1000));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('5 minutes ago');
  });

  it('renders in Spanish when the active language is Spanish', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');
    driveBackupService.lastBackupAt.set(new Date(Date.now() - 5 * 60 * 1000));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Copia de Google Drive');
    expect(text).toContain('Última copia: hace 5 minutos');
    expect(text).toContain('Hacer copia');

    const strip = fixture.nativeElement.querySelector('.backup-banner') as HTMLElement;
    expect(strip.getAttribute('aria-label')).toBe('Estado de la copia');
  });

  it('backs up when tapped', async () => {
    const spy = vi.spyOn(driveBackupService, 'backupNow').mockResolvedValue(undefined);
    const button = fixture.nativeElement.querySelector('.backup-action') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalled();
  });

  it('renders the strip as a non-interactive status region', () => {
    const strip = fixture.nativeElement.querySelector('.backup-banner') as HTMLElement;
    expect(strip.tagName).toBe('SECTION');
    expect(strip.getAttribute('aria-label')).toBe('Backup status');
  });

  it('renders an Offline state as a genuinely disabled control', async () => {
    networkService.isOnline.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Offline');

    const button = fixture.nativeElement.querySelector('.backup-action') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.disabled).toBe(true);

    const spy = vi.spyOn(driveBackupService, 'backupNow');
    button.click();
    component.backUp();
    await fixture.whenStable();

    expect(spy).not.toHaveBeenCalled();
  });

  it('disables the button while a backup is in progress', () => {
    driveBackupService.isBackingUp.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.backup-action') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('announces backup failure as a live region and dismisses it', async () => {
    driveBackupService.error.set('popup_closed_by_user');
    fixture.detectChanges();

    const strip = fixture.nativeElement.querySelector(
      '.backup-banner-error',
    ) as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.getAttribute('role')).toBe('alert');
    expect(strip.textContent).toContain('sign-in was cancelled');
    expect(strip.getAttribute('title')).toBe('popup_closed_by_user');

    const dismiss = strip.querySelector('.error-dismiss') as HTMLButtonElement;
    dismiss.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.backup-banner-error')).toBeNull();
  });

  it('clears a stale error when the app goes offline', () => {
    driveBackupService.error.set('Backup failed');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.backup-banner-error')).not.toBeNull();

    networkService.isOnline.set(false);
    fixture.detectChanges();

    expect(driveBackupService.error()).toBeNull();
    expect(fixture.nativeElement.querySelector('.backup-banner-error')).toBeNull();
  });
});

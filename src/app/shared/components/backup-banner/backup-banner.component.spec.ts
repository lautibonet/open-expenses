import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupBannerComponent } from './backup-banner.component';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';
import { ProfileService } from '../../../core/services/profile.service';
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

  it('backs up when tapped', async () => {
    const spy = vi.spyOn(driveBackupService, 'backupNow').mockResolvedValue(undefined);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalled();
  });

  it('renders an Offline state and does not back up when offline', async () => {
    networkService.isOnline.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Offline');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    const spy = vi.spyOn(driveBackupService, 'backupNow');
    component.backUp();
    await fixture.whenStable();

    expect(spy).not.toHaveBeenCalled();
  });

  it('disables the button while a backup is in progress', () => {
    driveBackupService.isBackingUp.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});

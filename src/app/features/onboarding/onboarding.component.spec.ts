import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { DriveBackupService } from '../../core/services/drive-backup.service';
import { NoBackupFoundError } from '../../backup/drive-backup-provider';
import { db } from '../../core/db/database';

describe('OnboardingComponent', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  let router: Router;
  let driveBackupService: {
    method: string;
    connect: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    restoreFromFile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    await db.delete();
    await db.open();

    driveBackupService = {
      method: 'Google Drive',
      connect: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(undefined),
      restoreFromFile: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        provideRouter([]),
        { provide: DriveBackupService, useValue: driveBackupService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('starts on the restore step offering cloud, file, and start fresh', () => {
    expect(component.step()).toBe(0);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Restore from Google Drive');
    expect(text).toContain('Upload backup file');
    expect(text).toContain('Start fresh');
  });

  it('shows the base currency step when starting fresh', () => {
    component.startFresh();
    fixture.detectChanges();

    expect(component.step()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Base Currency');
  });

  it('restores from cloud: connects, restores, and goes to the dashboard', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.restoreFromCloud();

    expect(driveBackupService.connect).toHaveBeenCalled();
    expect(driveBackupService.restore).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('stays on the restore step with a clear message when no cloud backup exists', async () => {
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    const navigate = vi.spyOn(router, 'navigate');

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.step()).toBe(0);
    expect(component.noBackupMessage()).toContain('No backup');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the no-backup message when the user starts fresh', async () => {
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    await component.restoreFromCloud();
    expect(component.noBackupMessage()).not.toBe('');

    component.startFresh();

    expect(component.noBackupMessage()).toBe('');
    expect(component.errorMessage()).toBe('');
  });

  it('shows an error when the cloud restore fails for another reason', async () => {
    driveBackupService.restore.mockRejectedValue(new Error('Cannot restore while offline'));

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.noBackupMessage()).toBe('');
    expect(component.errorMessage()).toBe('Cannot restore while offline');
  });

  it('restores from an uploaded file and goes to the dashboard', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    await component.restoreFromFile(file);

    expect(driveBackupService.restoreFromFile).toHaveBeenCalledWith(file);
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('shows an error when the uploaded file is invalid', async () => {
    driveBackupService.restoreFromFile.mockRejectedValue(new Error('Invalid backup file'));
    const navigate = vi.spyOn(router, 'navigate');
    const file = new File(['nope'], 'backup.json', { type: 'application/json' });

    await component.restoreFromFile(file);

    expect(component.errorMessage()).toBe('Invalid backup file');
    expect(navigate).not.toHaveBeenCalled();
  });
});
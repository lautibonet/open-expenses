import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { DriveBackupService } from '../../core/services/drive-backup.service';
import { LanguageService } from '../../core/services/language.service';
import { NoBackupFoundError } from '../../backup/drive-backup-provider';
import { db } from '../../core/db/database';

function stubNavigator(language: string): void {
  vi.stubGlobal('navigator', { language, languages: [language] });
}

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
    stubNavigator('en-GB');
    await createComponent();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.delete();
  });

  it('starts on the language step preselected from the browser language', async () => {
    stubNavigator('es-ES');
    await createComponent();

    expect(component.step()).toBe('language');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Language');
    expect(component.language()).toBe('es');
  });

  it('offers the restore step after the language step', () => {
    component.goTo('restore');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Restore from Google Drive');
    expect(text).toContain('Restore from file');
    expect(text).toContain('Start fresh');
  });

  it('renders the following steps in the chosen language immediately', async () => {
    await component.onLanguageChange('es');
    fixture.detectChanges();

    component.goTo('currency');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Moneda base');
    expect(text).not.toContain('Base Currency');
  });

  it('shows the base currency step when starting fresh', () => {
    component.startFresh();
    fixture.detectChanges();

    expect(component.step()).toBe('currency');
    expect(fixture.nativeElement.textContent).toContain('Base Currency');
  });

  it('derives step numbers from the named steps instead of hard-coding them', () => {
    component.goTo('currency');

    expect(component.stepNumber('language')).toBe(1);
    expect(component.stepNumber('restore')).toBe(2);
    expect(component.stepNumber('currency')).toBe(3);
    expect(component.stepNumber('accounts')).toBe(4);
    expect(component.stepNumber('categories')).toBe(5);
  });

  it('walks the whole flow in order: language, restore, currency, accounts, categories', () => {
    expect(component.step()).toBe('language');

    component.goTo('restore');
    component.startFresh();
    expect(component.step()).toBe('currency');

    component.goTo('accounts');
    expect(component.step()).toBe('accounts');

    component.goTo('categories');
    expect(component.step()).toBe('categories');

    component.goTo('accounts');
    expect(component.step()).toBe('accounts');
  });

  it('persists the chosen language to the profile when completing onboarding', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.onLanguageChange('es');

    await component.completeOnboarding();

    expect((await db.profile.get(1))!.language).toBe('es');
  });

  it('prefills the categories in the browser language', async () => {
    stubNavigator('es-ES');
    await createComponent();

    const names = component.categories().map(c => c.name);
    expect(names).toContain('Comida');
    expect(names).toContain('Transporte');
    expect(names).not.toContain('Food');
  });

  it('re-applies the chosen Language to untouched default categories', async () => {
    expect(component.categories().map(c => c.name)).toContain('Food');

    await component.onLanguageChange('es');

    const names = component.categories().map(c => c.name);
    expect(names).toContain('Comida');
    expect(names).not.toContain('Food');
  });

  it('keeps user-renamed categories when the language changes', async () => {
    component.updateCategoryField(0, 'name', 'Groceries');

    await component.onLanguageChange('es');

    const names = component.categories().map(c => c.name);
    expect(names).toContain('Groceries');
    expect(names).toContain('Transporte');
  });

  it('seeds Spanish category names into the database when completing onboarding in Spanish', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await component.onLanguageChange('es');

    await component.completeOnboarding();

    const cats = await db.categories.toArray();
    expect(cats.length).toBe(9);
    expect(cats.map(c => c.name)).toContain('Comida');
    expect(cats.map(c => c.name)).not.toContain('Food');
  });

  it('seeds English category names into the database when completing onboarding in English', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.completeOnboarding();

    const cats = await db.categories.toArray();
    expect(cats.length).toBe(9);
    expect(cats.map(c => c.name)).toContain('Food');
    expect(cats.map(c => c.name)).not.toContain('Comida');
  });

  it('restores from cloud: connects, restores, and goes to the dashboard', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.restoreFromCloud();

    expect(driveBackupService.connect).toHaveBeenCalled();
    expect(driveBackupService.restore).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('stays on the restore step with a clear message when no cloud backup exists', async () => {
    component.goTo('restore');
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    const navigate = vi.spyOn(router, 'navigate');

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.step()).toBe('restore');
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

describe('OnboardingComponent restore language override', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  let router: Router;
  let languageService: LanguageService;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    router = TestBed.inject(Router);
    languageService = TestBed.inject(LanguageService);
    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('applies the backup language over the one chosen during onboarding', async () => {
    component.onLanguageChange('en');
    expect(languageService.activeLanguage()).toBe('en');

    const snapshot = {
      accounts: [],
      categories: [],
      transactions: [],
      transfers: [],
      profile: [
        { id: 1, baseCurrency: 'EUR', language: 'es', onboardingCompleted: true, lastBackupAt: null },
      ],
      exportedAt: new Date().toISOString(),
    };
    const file = new File([JSON.stringify(snapshot)], 'backup.json', {
      type: 'application/json',
    });
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.restoreFromFile(file);

    expect((await db.profile.get(1))!.language).toBe('es');
    expect(languageService.activeLanguage()).toBe('es');
  });
});

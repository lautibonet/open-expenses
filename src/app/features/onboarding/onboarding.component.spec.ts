import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { OnboardingComponent } from './onboarding.component';
import { DriveBackupService } from '../../core/services/drive-backup.service';
import { LanguageService } from '../../core/services/language.service';
import { NoBackupFoundError } from '../../backup/drive-backup-provider';
import { TranslationError } from '../../core/models/translation-error';
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

  it('returns to the language step from the restore step via its Back button', () => {
    component.goTo('restore');
    fixture.detectChanges();

    const back = fixture.nativeElement.querySelector(
      '.nav-buttons .btn:not(.primary)',
    ) as HTMLButtonElement;
    expect(back).toBeTruthy();
    back.click();

    expect(component.step()).toBe('language');
  });

  it('keeps restore state when going back from the restore step and returning', async () => {
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    await component.restoreFromCloud();
    expect(component.infoMessage()).toContain('No backup');

    component.goTo('language');
    expect(component.step()).toBe('language');

    component.goTo('restore');
    fixture.detectChanges();
    expect(component.infoMessage()).toContain('No backup');
    expect(component.language()).toBe('en');
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

  it('reflects the wizard state in the step tab bar', () => {
    component.goTo('currency');
    fixture.detectChanges();

    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('.step-tab'),
    ) as HTMLElement[];
    expect(tabs.length).toBe(5);
    expect(tabs[0].classList).toContain('completed');
    expect(tabs[1].classList).toContain('completed');
    expect(tabs[2].classList).toContain('current');
    expect(tabs[2].getAttribute('aria-current')).toBe('step');
    expect(tabs[3].classList).not.toContain('completed');
    expect(tabs[3].classList).not.toContain('current');
    expect(tabs[4].classList).not.toContain('completed');
    expect(tabs[4].classList).not.toContain('current');
  });

  it('offers the featured currency tiles and marks the selection', () => {
    component.startFresh();
    fixture.detectChanges();

    const tiles = Array.from(
      fixture.nativeElement.querySelectorAll('.currency-grid .select-tile'),
    ) as HTMLElement[];
    const codes = tiles.map(t => t.querySelector('.tile-code')!.textContent!.trim());
    expect(codes).toEqual(['EUR', 'USD', 'GBP', 'JPY']);

    const selected = tiles.find(t => t.classList.contains('selected'));
    expect(selected!.querySelector('.tile-code')!.textContent!.trim()).toBe('EUR');
  });

  it('pins the currency search above the grid and drops the symbol caption', () => {
    component.startFresh();
    fixture.detectChanges();

    const panel = fixture.nativeElement as HTMLElement;
    const search = panel.querySelector('.currency-search') as HTMLElement;
    const grid = panel.querySelector('.currency-grid') as HTMLElement;
    expect(search).toBeTruthy();
    expect(grid).toBeTruthy();
    // The search block precedes the grid instead of being a grid child.
    expect(search.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grid.querySelector('.currency-search')).toBeNull();

    const text = panel.textContent as string;
    expect(text).not.toContain('Symbol:');
    expect(panel.querySelector('.tile-symbol-line')).toBeNull();
    // Tiles keep the top-right symbol.
    expect(grid.querySelector('.tile-symbol')).toBeTruthy();
  });

  it('selects a currency tile on click', () => {
    component.startFresh();
    fixture.detectChanges();

    const usd = (
      Array.from(fixture.nativeElement.querySelectorAll('.select-tile')) as HTMLElement[]
    ).find(t => t.querySelector('.tile-code')!.textContent!.trim() === 'USD')!;
    usd.click();

    expect(component.baseCurrency()).toBe('USD');
  });

  it('filters currency tiles from the search field by code or name', () => {
    component.startFresh();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#currency-search') as HTMLInputElement;
    const codes = (): string[] =>
      (
        Array.from(fixture.nativeElement.querySelectorAll('.select-tile')) as HTMLElement[]
      ).map(t => t.querySelector('.tile-code')!.textContent!.trim());

    input.value = 'swiss';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(codes()).toEqual(['CHF']);
    expect(fixture.nativeElement.querySelector('#currency-search')).toBeTruthy();

    input.value = 'japan';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(codes()).toEqual(['JPY']);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(codes()).toEqual(['EUR', 'USD', 'GBP', 'JPY']);
  });

  it('renders account rows as name plus symbol amount, removed via an X icon without confirm', () => {
    vi.stubGlobal('navigator', {
      language: 'en-GB',
      languages: ['en-GB'],
      userAgent: 'vitest',
    });
    component.goTo('accounts');
    fixture.detectChanges();

    component.accounts.set([
      { name: 'Checking', currency: 'EUR', balance: 1250 },
      { name: 'Cash', currency: 'CLP', balance: 30000 },
    ]);
    fixture.detectChanges();

    const rows = Array.from(
      fixture.nativeElement.querySelectorAll('.account-list li'),
    ) as HTMLElement[];
    expect(rows.length).toBe(2);
    // Symbol before amount, no em dash; code falls back when no symbol exists.
    expect(rows[0].textContent).toContain('Checking');
    expect(rows[0].textContent).toContain('€ 1250');
    expect(rows[0].textContent).not.toContain('—');
    expect(rows[1].textContent).toContain('Cash');
    expect(rows[1].textContent).toContain('CLP 30000');

    const remove = rows[0].querySelector('button') as HTMLButtonElement;
    expect(remove.classList).toContain('icon-btn');
    expect(remove.getAttribute('aria-label')).toBe('Remove');
    expect(remove.querySelector('svg')).toBeTruthy();
    remove.click();

    expect(component.accounts().length).toBe(1);
    expect(component.accounts()[0].name).toBe('Cash');
  });

  it('lands on Movements when the fresh wizard completes', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.completeOnboarding();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
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

  it('restores from cloud: connects, restores, and lands on Movements', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await component.restoreFromCloud();

    expect(driveBackupService.connect).toHaveBeenCalled();
    expect(driveBackupService.restore).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('stays on the restore step with a clear message when no cloud backup exists', async () => {
    component.goTo('restore');
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    const navigate = vi.spyOn(router, 'navigate');

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.step()).toBe('restore');
    expect(component.infoMessage()).toContain('No backup');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the no-backup message when the user starts fresh', async () => {
    driveBackupService.restore.mockRejectedValue(new NoBackupFoundError());
    await component.restoreFromCloud();
    expect(component.infoMessage()).not.toBe('');

    component.startFresh();

    expect(component.infoMessage()).toBe('');
    expect(component.errorMessage()).toBe('');
  });

  it('shows an error when the cloud restore fails for another reason', async () => {
    driveBackupService.restore.mockRejectedValue(
      new TranslationError('backup.error.offlineRestore'),
    );

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.infoMessage()).toBe('');
    expect(component.errorMessage()).toBe('Cannot restore while offline');
  });

  it('re-enables the restore step with a neutral notice when sign-in is cancelled', async () => {
    component.goTo('restore');
    driveBackupService.connect.mockRejectedValue(
      new TranslationError('backup.error.oauth.cancelled'),
    );
    const navigate = vi.spyOn(router, 'navigate');

    await component.restoreFromCloud();
    fixture.detectChanges();

    expect(component.isRestoring()).toBe(false);
    expect(component.step()).toBe('restore');
    expect(component.infoMessage()).toContain('cancelled');
    expect(component.errorMessage()).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores from an uploaded file and lands on Movements', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    await component.restoreFromFile(file);

    expect(driveBackupService.restoreFromFile).toHaveBeenCalledWith(file);
    expect(navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('shows an error when the uploaded file is invalid', async () => {
    driveBackupService.restoreFromFile.mockRejectedValue(
      new TranslationError('backup.error.invalidFile'),
    );
    const navigate = vi.spyOn(router, 'navigate');
    const file = new File(['nope'], 'backup.json', { type: 'application/json' });

    await component.restoreFromFile(file);

    expect(component.errorMessage()).toBe('Invalid backup file');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('dismisses an error note and shows it again on the next failure', () => {
    vi.stubGlobal('navigator', {
      language: 'en-GB',
      languages: ['en-GB'],
      userAgent: 'vitest',
    });
    component.goTo('accounts');
    fixture.detectChanges();

    component.addAccount();
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('.alert') as HTMLElement;
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('required');

    (alert.querySelector('.alert-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();

    component.addAccount();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert')).toBeTruthy();
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

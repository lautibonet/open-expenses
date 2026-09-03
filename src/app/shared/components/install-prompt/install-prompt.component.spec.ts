import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InstallPromptComponent } from './install-prompt.component';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { LanguageService } from '../../../core/services/language.service';
import { db } from '../../../core/db/database';

describe('InstallPromptComponent', () => {
  let fixture: ComponentFixture<InstallPromptComponent>;
  let pwaInstall: {
    canInstall: () => boolean;
    install: () => Promise<boolean>;
    dismiss: () => void;
  };

  beforeEach(async () => {
    await db.delete();
    await db.open();

    pwaInstall = {
      canInstall: vi.fn(() => true),
      install: vi.fn(async () => true),
      dismiss: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InstallPromptComponent],
      providers: [{ provide: PwaInstallService, useValue: pwaInstall }],
    }).compileComponents();

    fixture = TestBed.createComponent(InstallPromptComponent);
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('shows the install prompt in the active language', async () => {
    expect(fixture.nativeElement.textContent).toContain('Install Open Expenses for quick access');
    expect(fixture.nativeElement.textContent).toContain('Install');
    expect(fixture.nativeElement.textContent).toContain('Dismiss');

    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Instala Open Expenses');
    expect(fixture.nativeElement.textContent).toContain('Instalar');
    expect(fixture.nativeElement.textContent).toContain('Descartar');
  });

  it('announces its appearance politely via a status live region', () => {
    const strip = fixture.nativeElement.querySelector('[role="status"]');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('Install Open Expenses for quick access');
  });

  it('delegates to the install service', async () => {
    (fixture.nativeElement.querySelector('.btn.primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(pwaInstall.install).toHaveBeenCalled();

    (fixture.nativeElement.querySelector('.btn:not(.primary)') as HTMLButtonElement).click();
    expect(pwaInstall.dismiss).toHaveBeenCalled();
  });
});

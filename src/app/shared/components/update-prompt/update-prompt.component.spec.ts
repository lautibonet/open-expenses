import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpdatePromptComponent } from './update-prompt.component';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { LanguageService } from '../../../core/services/language.service';
import { db } from '../../../core/db/database';

describe('UpdatePromptComponent', () => {
  let ready: boolean;
  let pwaUpdate: {
    updateReady: () => boolean;
    applyUpdate: () => Promise<void>;
    dismiss: () => void;
  };
  let fixture: ComponentFixture<UpdatePromptComponent>;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    ready = true;
    pwaUpdate = {
      updateReady: () => ready,
      applyUpdate: vi.fn(async () => {}),
      dismiss: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UpdatePromptComponent],
      providers: [{ provide: PwaUpdateService, useValue: pwaUpdate }],
    }).compileComponents();
  });

  afterEach(async () => {
    await db.delete();
  });

  function createFixture(): void {
    fixture = TestBed.createComponent(UpdatePromptComponent);
    fixture.detectChanges();
  }

  it('shows the update prompt in the active language', async () => {
    createFixture();
    expect(fixture.nativeElement.textContent).toContain('A new version of Open Expenses is ready');
    expect(fixture.nativeElement.textContent).toContain('Reload');
    expect(fixture.nativeElement.textContent).toContain('Later');

    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Una nueva versión de Open Expenses');
    expect(fixture.nativeElement.textContent).toContain('Recargar');
    expect(fixture.nativeElement.textContent).toContain('Más tarde');
  });

  it('announces its appearance politely via a status live region', () => {
    createFixture();
    const strip = fixture.nativeElement.querySelector('[role="status"]');
    expect(strip).not.toBeNull();
    expect(strip.textContent).toContain('A new version of Open Expenses is ready');
  });

  it('reloads onto the new version via the update service', async () => {
    createFixture();
    (fixture.nativeElement.querySelector('.btn.primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(pwaUpdate.applyUpdate).toHaveBeenCalled();

    (fixture.nativeElement.querySelector('.btn:not(.primary)') as HTMLButtonElement).click();
    expect(pwaUpdate.dismiss).toHaveBeenCalled();
  });

  it('renders nothing while no update is ready', () => {
    ready = false;
    createFixture();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});

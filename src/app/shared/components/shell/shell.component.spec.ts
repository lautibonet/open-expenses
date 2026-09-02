import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { routes } from '../../../app.routes';
import { LanguageService } from '../../../core/services/language.service';
import { CaptureFormService } from '../../../core/services/capture-form.service';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { db } from '../../../core/db/database';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    (window as any).matchMedia =
      (window as any).matchMedia ||
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('renders the sidebar Backup as a bordered button with a status caption', () => {
    const banner = fixture.nativeElement.querySelector('app-backup-banner');
    expect(banner).toBeNull();

    const button = fixture.nativeElement.querySelector('button.backup-button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent?.trim()).toBe('Back up');

    const block = fixture.nativeElement.querySelector('.backup-block') as HTMLElement;
    expect(block.getAttribute('role')).toBe('group');
    expect(block.getAttribute('aria-label')).toBe('Backup status');

    const caption = fixture.nativeElement.querySelector('.backup-caption') as HTMLElement;
    expect(caption.textContent?.trim()).toBe('Last backup: Never');
  });

  it('shows the backup method with the relative last-backup time in the caption', () => {
    const backupService = TestBed.inject(DriveBackupService);
    backupService.lastBackupAt.set(new Date(Date.now() - 5 * 60 * 1000));
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('.backup-caption') as HTMLElement;
    expect(caption.textContent?.trim()).toBe('Google Drive · Last backup: 5 minutes ago');
  });

  it('renders the backup button and caption in Spanish', async () => {
    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.backup-button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Hacer copia');

    const block = fixture.nativeElement.querySelector('.backup-block') as HTMLElement;
    expect(block.getAttribute('aria-label')).toBe('Estado de la copia');

    const caption = fixture.nativeElement.querySelector('.backup-caption') as HTMLElement;
    expect(caption.textContent?.trim()).toBe('Última copia: Nunca');
  });

  it('backs up when the sidebar button is tapped', async () => {
    const backupService = TestBed.inject(DriveBackupService);
    const spy = vi.spyOn(backupService, 'backupNow').mockResolvedValue(undefined);

    const button = fixture.nativeElement.querySelector('button.backup-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();

    expect(spy).toHaveBeenCalled();
  });

  it('disables the backup button while a backup is in progress', () => {
    const backupService = TestBed.inject(DriveBackupService);
    backupService.isBackingUp.set(true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.backup-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent?.trim()).toBe('Backing up…');
  });

  it('renders the main navigation tabs in Movements, Stats, Settings order', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.tab')).map(
      (a) => (a as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toEqual(['Movements', 'Stats', 'Settings']);
  });

  it('names each nav tab accessibly and renders an icon beside its label', () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a.tab') as NodeListOf<HTMLAnchorElement>,
    );
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Movements',
      'Stats',
      'Settings',
    ]);

    for (const link of links) {
      const icon = link.querySelector('svg.tab-icon') as SVGElement | null;
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(icon?.querySelectorAll('path').length).toBeGreaterThan(0);
      expect(link.querySelector('.tab-label')).not.toBeNull();
    }
  });

  it('keeps the Stats tab linked to the stats route', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.tab'));
    const statsLink = links.find(
      (a) => (a as HTMLAnchorElement).textContent?.trim() === 'Stats',
    ) as HTMLAnchorElement;
    expect(statsLink.getAttribute('href')).toBe('/stats');
  });

  it('renders the navigation labels in the active language', async () => {
    const languageService = TestBed.inject(LanguageService);
    await languageService.setLanguage('es');
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a.tab')).map(
      (a) => (a as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toEqual(['Movimientos', 'Estadísticas', 'Ajustes']);
    expect(fixture.nativeElement.querySelector('.skip-link')?.textContent?.trim()).toBe(
      'Saltar al contenido',
    );
    expect(fixture.nativeElement.querySelector('nav.tab-bar')?.getAttribute('aria-label')).toBe(
      'Principal',
    );
  });

  it('renders the brand block with the monogram and the untranslated wordmark', () => {
    const brand = fixture.nativeElement.querySelector('.brand') as HTMLElement;
    expect(brand).not.toBeNull();
    expect(brand.querySelector('.monogram')?.textContent?.trim()).toBe('O');
    expect(brand.querySelector('.wordmark')?.textContent?.trim()).toBe('Open Expenses');
  });

  it('routes the Quick Add CTA to Movements when used from another page', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.goToQuickAdd();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('does not re-navigate when Quick Add is used on Movements', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/movements');

    await fixture.componentInstance.goToQuickAdd();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('requests the Quick Add form open when used on Movements', async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/movements');

    await fixture.componentInstance.goToQuickAdd();

    expect(captureFormService.pendingQuickAddRequests()).toBe(1);
  });

  it('routes to Movements and requests the Quick Add form open from another page', async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.goToQuickAdd();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
    expect(captureFormService.pendingQuickAddRequests()).toBe(1);
  });

  it("routes to Movements and opens the transfer form when 't' is pressed elsewhere", async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.goToTransferForm();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
    expect(captureFormService.pendingTransferRequests()).toBe(1);
  });

  it("routes to Movements and requests Quick Add when 'n' is pressed on another page", async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.onDocKeydown(new KeyboardEvent('keydown', { key: 'n' }));

    expect(navigate).toHaveBeenCalledWith(['/movements']);
    expect(captureFormService.pendingQuickAddRequests()).toBe(1);
  });

  it('leaves the shortcuts to the Movements page when it is active', async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/movements');

    fixture.componentInstance.onDocKeydown(new KeyboardEvent('keydown', { key: 'n' }));
    fixture.componentInstance.onDocKeydown(new KeyboardEvent('keydown', { key: 't' }));

    expect(captureFormService.pendingQuickAddRequests()).toBe(0);
    expect(captureFormService.pendingTransferRequests()).toBe(0);
  });
});

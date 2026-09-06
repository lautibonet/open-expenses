import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { ShellComponent } from './shell.component';
import { routes } from '../../../app.routes';
import { LanguageService } from '../../../core/services/language.service';
import { CaptureFormService } from '../../../core/services/capture-form.service';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { db } from '../../../core/db/database';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;

  function compiledComponentCss(): string {
    return Array.from(document.querySelectorAll('style'))
      .map((s) => s.textContent ?? '')
      .join('\n');
  }

  // The mobile chrome rules live in the component stylesheet's last @media
  // block; slice from its opening line so desktop rules can't satisfy the
  // assertions.
  function mobileBlock(css: string): string {
    const start = css.indexOf('@media (max-width: 768px)');
    return start === -1 ? '' : css.slice(start);
  }

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

  it('links the Privacy page and the Landing from the app footer, in the active language (#132)', async () => {
    const links = Array.from(
      fixture.nativeElement.querySelectorAll('footer.app-footer a'),
    ) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/privacy', '/landing']);
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Privacy', 'About']);

    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Privacidad', 'Acerca de']);
  });

  // The visible version must be the released one: it comes straight from
  // package.json, the same field the v1.0.0 release tag cuts (#137).
  it('shows the package version in the app footer (#137)', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string };

    const version = fixture.nativeElement.querySelector('.app-version') as HTMLElement;
    expect(version).not.toBeNull();
    expect(version.textContent?.trim()).toBe(`v${pkg.version}`);
  });

  it('renders the main navigation tabs in Movements, Stats, Settings order', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.tab')).map(
      (a) => (a as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toEqual(['Movements', 'Stats', 'Settings']);
  });

  it('renders the capture slot between Stats and Settings in the nav bar', () => {
    const nav = fixture.nativeElement.querySelector('nav.tab-bar') as HTMLElement;
    const children = Array.from(nav.querySelectorAll('a.tab, button.capture-slot'));
    const kinds = children.map((el) =>
      el.tagName === 'A' ? (el as HTMLElement).textContent?.trim() : 'capture',
    );
    expect(kinds).toEqual(['Movements', 'Stats', 'capture', 'Settings']);

    const capture = nav.querySelector('button.capture-slot') as HTMLButtonElement;
    expect(capture.getAttribute('aria-label')).toBe('+ New Transaction');
    expect(capture.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('opens the Transaction Form from the capture slot', async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/movements');

    const capture = fixture.nativeElement.querySelector(
      'button.capture-slot',
    ) as HTMLButtonElement;
    capture.click();
    await fixture.whenStable();

    expect(captureFormService.pendingTransactionFormRequests()).toBe(1);
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

  it('renders the brand blocks with the Cell mark and the untranslated wordmark', () => {
    const brands = fixture.nativeElement.querySelectorAll('.brand') as NodeListOf<HTMLElement>;
    expect(brands.length).toBe(2);
    for (const brand of brands) {
      const mark = brand.querySelector('svg.cell-mark');
      expect(mark).not.toBeNull();
      expect(mark?.querySelector('rect[fill="#0052ff"]')).not.toBeNull();
      expect(brand.querySelector('.wordmark')?.textContent?.trim()).toBe('Open Expenses');
    }
  });

  // One strip at a time: the optional install suggestion never stacks with
  // the urgent update banner; it returns once the update banner is resolved.
  it('suppresses the install prompt while an update is ready and restores it after', () => {
    const pwaInstall = TestBed.inject(PwaInstallService);
    const pwaUpdate = TestBed.inject(PwaUpdateService);

    pwaInstall.canInstall.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.install-banner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.update-banner')).toBeNull();

    pwaUpdate.updateReady.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.install-banner')).toBeNull();
    expect(fixture.nativeElement.querySelector('.update-banner')).not.toBeNull();

    pwaUpdate.updateReady.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.install-banner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.update-banner')).toBeNull();
  });

  it('routes the New Transaction CTA to Movements when used from another page', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.goToTransactionForm();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('does not re-navigate when New Transaction is used on Movements', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/movements');

    await fixture.componentInstance.goToTransactionForm();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('requests the Transaction Form open when used on Movements', async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/movements');

    await fixture.componentInstance.goToTransactionForm();

    expect(captureFormService.pendingTransactionFormRequests()).toBe(1);
  });

  it('routes to Movements and requests the Transaction Form open from another page', async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.goToTransactionForm();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
    expect(captureFormService.pendingTransactionFormRequests()).toBe(1);
  });

  it("routes to Movements and opens the transfer form when 't' is pressed elsewhere", async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.goToTransferForm();

    expect(navigate).toHaveBeenCalledWith(['/movements']);
    expect(captureFormService.pendingTransferRequests()).toBe(1);
  });

  it("routes to Movements and requests the Transaction Form when 'n' is pressed on another page", async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await fixture.componentInstance.onDocKeydown(new KeyboardEvent('keydown', { key: 'n' }));

    expect(navigate).toHaveBeenCalledWith(['/movements']);
    expect(captureFormService.pendingTransactionFormRequests()).toBe(1);
  });

  it('leaves the shortcuts to the Movements page when it is active', async () => {
    const captureFormService = TestBed.inject(CaptureFormService);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/movements');

    fixture.componentInstance.onDocKeydown(new KeyboardEvent('keydown', { key: 'n' }));
    fixture.componentInstance.onDocKeydown(new KeyboardEvent('keydown', { key: 't' }));

    expect(captureFormService.pendingTransactionFormRequests()).toBe(0);
    expect(captureFormService.pendingTransferRequests()).toBe(0);
  });

  // jsdom does no layout, so the compiled declarations are the seam (#112).
  // The bar is sized from the token itself: the sidebar is border-box with a
  // min-height of --nav-bar-size + safe-area, so the 1px top border counts
  // inside the documented height and .main-area's equal offset clears it.
  it('sizes the mobile bottom nav bar from --nav-bar-size so the content offset clears it', () => {
    const block = mobileBlock(compiledComponentCss());

    expect(block).toMatch(
      /\.sidebar(\[[^\]]*\])?\s*\{[^}]*box-sizing:\s*border-box[^}]*min-height:\s*calc\(var\(--nav-bar-size\)\s*\+\s*env\(safe-area-inset-bottom\)\)/,
    );
    expect(block).toMatch(
      /\.main-area(\[[^\]]*\])?\s*\{[^}]*padding-bottom:\s*calc\(var\(--nav-bar-size\)\s*\+\s*env\(safe-area-inset-bottom\)\)/,
    );
  });

  // The tabs' content-box min-height stacked padding and borders on top of the
  // token (56px meant to be 75px measured); the bar's own height must size
  // them, so they carry no min-height of their own in the mobile regime.
  it('keeps the tab buttons and capture slot from stacking height onto the bar', () => {
    const block = mobileBlock(compiledComponentCss());

    const tabRule = block.match(/\.tab(\[[^\]]*\])?\s*\{([^}]*)\}/)?.[2] ?? '';
    expect(tabRule).not.toMatch(/min-height/);

    const captureRule = block.match(/\.capture-slot(\[[^\]]*\])?\s*\{([^}]*)\}/)?.[2] ?? '';
    expect(captureRule).not.toMatch(/min-height/);
  });

  it('keeps the sticky top bar at the documented token height with border-box', () => {
    const block = mobileBlock(compiledComponentCss());

    expect(block).toMatch(
      /\.top-bar(\[[^\]]*\])?\s*\{[^}]*box-sizing:\s*border-box[^}]*min-height:\s*var\(--nav-bar-size\)/,
    );
  });

  // The tabs now stretch to the bar instead of carrying their own min-height,
  // so the token's own value is what keeps them at touch-target size (#112).
  it('keeps the token tall enough that stretched tabs stay at touch-target size', () => {
    const tokens = readFileSync('src/styles.scss', 'utf-8');
    expect(tokens).toMatch(/--nav-bar-size:\s*3\.5rem/);
  });
});

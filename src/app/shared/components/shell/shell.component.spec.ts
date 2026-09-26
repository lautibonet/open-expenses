import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { ShellComponent } from './shell.component';
import { routes } from '../../../app.routes';
import { LanguageService } from '../../../core/services/language.service';
import { CaptureFormService } from '../../../core/services/capture-form.service';
import { DriveBackupService } from '../../../core/services/drive-backup.service';
import { NetworkService } from '../../../core/services/network.service';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { TranslationError } from '../../../core/models/translation-error';
import { db } from '../../../core/db/database';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;

  function snapshotStub() {
    return {
      accounts: [],
      categories: [],
      transactions: [],
      transfers: [],
      profile: [],
      exportedAt: '2026-08-27T00:00:00.000Z',
    };
  }

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
    expect(button.textContent?.trim()).toBe('Back up to Google Drive');

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
    expect(button.textContent?.trim()).toBe('Hacer copia en Google Drive');

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

  it('renders the cloud and file-download backup actions stacked in the backup block', () => {
    const block = fixture.nativeElement.querySelector('.backup-block') as HTMLElement;
    const buttons = Array.from(block.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual([
      'Back up to Google Drive',
      'Download backup file',
    ]);
  });

  it('downloads the current snapshot as a file when the sidebar download button is tapped', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const button = fixture.nativeElement.querySelector(
      'button.download-button',
    ) as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect(revokeObjectURL).toHaveBeenCalled();

    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('open-expenses-backup.json');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const parsed = JSON.parse(await blob.text());
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.accounts).toEqual([]);
  });

  it('disables both backup actions while a backup is in progress', () => {
    const backupService = TestBed.inject(DriveBackupService);
    backupService.isBackingUp.set(true);
    fixture.detectChanges();

    const backup = fixture.nativeElement.querySelector('button.backup-button') as HTMLButtonElement;
    const download = fixture.nativeElement.querySelector(
      'button.download-button',
    ) as HTMLButtonElement;
    expect(backup.disabled).toBe(true);
    expect(download.disabled).toBe(true);
  });

  it('disables both backup actions while a download is in progress', () => {
    fixture.componentInstance.isDownloading.set(true);
    fixture.detectChanges();

    const backup = fixture.nativeElement.querySelector('button.backup-button') as HTMLButtonElement;
    const download = fixture.nativeElement.querySelector(
      'button.download-button',
    ) as HTMLButtonElement;
    expect(backup.disabled).toBe(true);
    expect(download.disabled).toBe(true);
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

  it('renders the nav bar with only the three real page tabs', () => {
    const nav = fixture.nativeElement.querySelector('nav.tab-bar') as HTMLElement;
    const children = Array.from(nav.querySelectorAll('a.tab, button'));
    expect(children.length).toBe(3);
    expect(children.every((el) => el.tagName === 'A')).toBe(true);
  });

  it('renders two ghost quick actions in the top bar, Backup and Restore', () => {
    const actions = Array.from(
      fixture.nativeElement.querySelectorAll('.top-bar-actions .quick-action'),
    ) as HTMLButtonElement[];
    expect(actions.length).toBe(2);

    expect(actions[0].getAttribute('aria-label')).toBe('Back up to Google Drive');
    expect(actions[0].getAttribute('title')).toBe('Back up to Google Drive');
    expect(actions[0].querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    expect(actions[1].getAttribute('aria-label')).toBe('Restore from Google Drive');
    expect(actions[1].getAttribute('title')).toBe('Restore from Google Drive');
    expect(actions[1].querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('disables both quick actions while a backup is in progress', () => {
    const backupService = TestBed.inject(DriveBackupService);
    backupService.isBackingUp.set(true);
    fixture.detectChanges();

    const actions = fixture.nativeElement.querySelectorAll(
      '.quick-action',
    ) as NodeListOf<HTMLButtonElement>;
    expect(actions[0].disabled).toBe(true);
    expect(actions[1].disabled).toBe(true);
  });

  it('disables both quick actions while offline', () => {
    TestBed.inject(NetworkService).isOnline.set(false);
    fixture.detectChanges();

    const actions = fixture.nativeElement.querySelectorAll(
      '.quick-action',
    ) as NodeListOf<HTMLButtonElement>;
    expect(actions[0].disabled).toBe(true);
    expect(actions[1].disabled).toBe(true);
  });

  it('backs up from the quick action and shows the transient success strip', async () => {
    vi.useFakeTimers();
    try {
      const backupService = TestBed.inject(DriveBackupService);
      vi.spyOn(backupService, 'backupNow').mockImplementation(async () => {
        backupService.lastBackupAt.set(new Date());
        return undefined;
      });

      const actions = fixture.nativeElement.querySelectorAll(
        '.quick-action',
      ) as NodeListOf<HTMLButtonElement>;
      actions[0].click();
      await vi.advanceTimersByTimeAsync(1000);
      await fixture.whenStable();
      fixture.detectChanges();

      const strip = fixture.nativeElement.querySelector('.feedback-strip') as HTMLElement;
      expect(strip.textContent).toContain('Backed up · Just now');
      expect(strip.getAttribute('role')).toBe('status');

      // Success feedback is transient: it self-clears after ~4s.
      await vi.advanceTimersByTimeAsync(4100);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.feedback-strip')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a failed backup in the strip until dismissed', async () => {
    const backupService = TestBed.inject(DriveBackupService);
    backupService.error.set(new TranslationError('backup.error.backupFailed'));
    vi.spyOn(backupService, 'backupNow').mockRejectedValue(new Error('Failed to fetch'));

    const actions = fixture.nativeElement.querySelectorAll(
      '.quick-action',
    ) as NodeListOf<HTMLButtonElement>;
    actions[0].click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.feedback-strip.error')).not.toBeNull();
    });

    const strip = fixture.nativeElement.querySelector('.feedback-strip') as HTMLElement;
    expect(strip.getAttribute('role')).toBe('alert');

    (fixture.nativeElement.querySelector('.feedback-dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.feedback-strip')).toBeNull();
  });

  it('fetches the cloud snapshot and opens the restore confirm sheet', async () => {
    const snapshot = {
      accounts: [],
      categories: [],
      transactions: [],
      transfers: [],
      profile: [],
      exportedAt: '2026-08-27T00:00:00.000Z',
    };
    const backupService = TestBed.inject(DriveBackupService);
    vi.spyOn(backupService, 'getCloudSnapshot').mockResolvedValue(snapshot as never);
    fixture.componentInstance.isMobileLayout.set(true);

    const actions = fixture.nativeElement.querySelectorAll(
      '.quick-action',
    ) as NodeListOf<HTMLButtonElement>;
    actions[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(backupService.pendingRestore()).not.toBeNull();
    const sheet = fixture.nativeElement.querySelector('app-bottom-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.textContent).toContain('Restore from Google Drive');
    expect(sheet.textContent).toContain('This replaces all current data.');
    expect(sheet.textContent).toContain('Restore data');
  });

  it('spins the restore icon while its snapshot fetch is in flight', async () => {
    const backupService = TestBed.inject(DriveBackupService);
    let releaseFetch: (() => void) | undefined;
    vi.spyOn(backupService, 'getCloudSnapshot').mockImplementation(async () => {
      backupService.isBackingUp.set(true);
      await new Promise<void>((resolve) => {
        releaseFetch = () => resolve();
      });
      backupService.isBackingUp.set(false);
      return snapshotStub() as never;
    });
    fixture.componentInstance.isMobileLayout.set(true);

    const actions = fixture.nativeElement.querySelectorAll(
      '.quick-action',
    ) as NodeListOf<HTMLButtonElement>;
    actions[1].click();

    fixture.detectChanges();
    expect(actions[1].querySelector('svg.spin')).not.toBeNull();
    expect(actions[0].querySelector('svg.spin')).toBeNull();

    releaseFetch?.();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(actions[1].querySelector('svg.spin')).toBeNull();
  });

  it('keeps the restore sheet closed when the pending restore comes from the Settings card', () => {
    const snapshot = snapshotStub();
    TestBed.inject(DriveBackupService).pendingRestore.set(snapshot);
    fixture.componentInstance.isMobileLayout.set(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.restoreSheetOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('app-bottom-sheet')).toBeNull();
  });

  it('confirms a restore from the sheet with success feedback', async () => {
    const snapshot = {
      accounts: [],
      categories: [],
      transactions: [],
      transfers: [],
      profile: [{ id: 1, baseCurrency: 'USD', onboardingCompleted: true, lastBackupAt: null }],
      exportedAt: new Date().toISOString(),
    };
    const backupService = TestBed.inject(DriveBackupService);
    vi.spyOn(backupService, 'getCloudSnapshot').mockResolvedValue(snapshot as never);
    vi.spyOn(backupService, 'restoreFromSnapshot').mockResolvedValue(undefined);
    fixture.componentInstance.isMobileLayout.set(true);

    const actions = fixture.nativeElement.querySelectorAll(
      '.quick-action',
    ) as NodeListOf<HTMLButtonElement>;
    actions[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    const danger = Array.from(
      fixture.nativeElement.querySelectorAll('.restore-confirm-actions button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.trim() === 'Restore data') as HTMLButtonElement;
    danger.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(backupService.pendingRestore()).toBeNull();
    const strip = fixture.nativeElement.querySelector('.feedback-strip') as HTMLElement;
    expect(strip.textContent).toContain('Restored · Just now');
  });

  it('cancelling the restore sheet leaves data untouched and closes it', async () => {
    const backupService = TestBed.inject(DriveBackupService);
    vi.spyOn(backupService, 'getCloudSnapshot').mockResolvedValue(snapshotStub() as never);
    const restoreSpy = vi.spyOn(backupService, 'restoreFromSnapshot');
    fixture.componentInstance.isMobileLayout.set(true);

    const actions = fixture.nativeElement.querySelectorAll(
      '.quick-action',
    ) as NodeListOf<HTMLButtonElement>;
    actions[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    const cancel = Array.from(
      fixture.nativeElement.querySelectorAll('.restore-confirm-actions button'),
    ).find((b) => (b as HTMLButtonElement).textContent?.trim() === 'Cancel') as HTMLButtonElement;
    cancel.click();
    fixture.detectChanges();

    expect(backupService.pendingRestore()).toBeNull();
    expect(restoreSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-bottom-sheet')).toBeNull();
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
  it('keeps the tab buttons from stacking height onto the bar', () => {
    const block = mobileBlock(compiledComponentCss());

    const tabRule = block.match(/\.tab(\[[^\]]*\])?\s*\{([^}]*)\}/)?.[2] ?? '';
    expect(tabRule).not.toMatch(/min-height/);
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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { routes } from '../../../app.routes';
import { LanguageService } from '../../../core/services/language.service';
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

  it('renders the backup banner in the app shell', () => {
    expect(fixture.nativeElement.querySelector('app-backup-banner')).toBeTruthy();
  });

  it('renders the main navigation tabs in Movements, Stats, Settings order', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.tab')).map(
      (a) => (a as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toEqual(['Movements', 'Stats', 'Settings']);
  });

  it('keeps the Stats tab linked to the dashboard route', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.tab'));
    const statsLink = links.find(
      (a) => (a as HTMLAnchorElement).textContent?.trim() === 'Stats',
    ) as HTMLAnchorElement;
    expect(statsLink.getAttribute('href')).toBe('/dashboard');
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

  it('renders the local-storage status chip in the active language', async () => {
    expect(fixture.nativeElement.querySelector('.status-chip')?.textContent?.trim()).toBe(
      'Local storage',
    );

    await TestBed.inject(LanguageService).setLanguage('es');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.status-chip')?.textContent?.trim()).toBe(
      'Almacenamiento local',
    );
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

  it('scrolls to and focuses the Quick Add capture card', async () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    const amountInput = { focus } as unknown as HTMLInputElement;
    const card = {
      scrollIntoView,
      querySelector: vi.fn().mockReturnValue(amountInput),
    } as unknown as HTMLElement;
    const querySpy = vi.spyOn(document, 'querySelector').mockReturnValue(card);

    await fixture.componentInstance.goToQuickAdd();

    expect(querySpy).toHaveBeenCalledWith('app-quick-add-card');
    expect(scrollIntoView).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    querySpy.mockRestore();
  });

  it('tolerates a missing Quick Add card', async () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const querySpy = vi.spyOn(document, 'querySelector').mockReturnValue(null);

    await expect(fixture.componentInstance.goToQuickAdd()).resolves.toBeUndefined();
    querySpy.mockRestore();
  });

  it('points the Backup link at the Settings backup card', () => {
    const link = fixture.nativeElement.querySelector('a.backup-link') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/settings#backup');
  });
});

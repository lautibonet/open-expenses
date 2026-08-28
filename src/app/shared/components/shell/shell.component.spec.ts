import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';
import { routes } from '../../../app.routes';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(async () => {
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
});

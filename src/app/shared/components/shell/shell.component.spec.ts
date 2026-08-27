import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';

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
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  it('renders the backup banner in the app shell', () => {
    expect(fixture.nativeElement.querySelector('app-backup-banner')).toBeTruthy();
  });

  it('renders the main navigation tabs', () => {
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.tab')).map(
      (a) => (a as HTMLAnchorElement).textContent?.trim(),
    );
    expect(links).toContain('Dashboard');
    expect(links).toContain('Movements');
    expect(links).toContain('Settings');
  });
});

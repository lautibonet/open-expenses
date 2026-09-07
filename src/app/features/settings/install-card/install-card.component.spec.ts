import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InstallCardComponent } from './install-card.component';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { db } from '../../../core/db/database';

describe('InstallCardComponent', () => {
  let pwaInstall: PwaInstallService;
  let fixture: ComponentFixture<InstallCardComponent>;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [InstallCardComponent],
    }).compileComponents();

    pwaInstall = TestBed.inject(PwaInstallService);
    fixture = TestBed.createComponent(InstallCardComponent);
    fixture.detectChanges();
  });

  afterEach(async () => {
    localStorage.clear();
    await db.delete();
  });

  it('renders the install card with its action while the browser offers installation', () => {
    pwaInstall.hasInstallPrompt.set(true);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('#install') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Install the app');
    expect(card.querySelector('.btn')).not.toBeNull();
  });

  it('stays visible without a native prompt, showing a hint instead of the action', () => {
    pwaInstall.hasInstallPrompt.set(false);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('#install') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.querySelector('.btn')).toBeNull();
    expect(card.textContent).toContain('not available');
  });

  it('stays hidden once the app is installed', () => {
    pwaInstall.hasInstallPrompt.set(true);
    pwaInstall.isInstalled.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#install')).toBeNull();
  });

  // The card is the permanent fallback for the dismissible banner: even with
  // the banner's 7-day dismissal flag active, an offered install shows here.
  it('stays visible while the banner dismissal flag is active', () => {
    localStorage.setItem('open-expenses_pwa_install_dismissed', String(Date.now()));

    const event = new Event('beforeinstallprompt');
    window.dispatchEvent(event);
    fixture.detectChanges();

    expect(pwaInstall.canInstall()).toBe(false);
    expect(fixture.nativeElement.querySelector('#install')).not.toBeNull();
  });

  it('starts the native install flow from the card button', async () => {
    pwaInstall.hasInstallPrompt.set(true);
    fixture.detectChanges();
    const spy = vi.spyOn(pwaInstall, 'install').mockResolvedValue(true);

    const button = fixture.nativeElement.querySelector('#install .btn') as HTMLButtonElement;
    button.click();

    expect(spy).toHaveBeenCalled();
  });
});

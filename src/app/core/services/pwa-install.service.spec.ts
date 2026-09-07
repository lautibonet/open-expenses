import { PwaInstallService } from './pwa-install.service';

const DISMISS_KEY = 'open-expenses_pwa_install_dismissed';

interface MockBeforeInstallPromptEvent extends Event {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function dispatchInstallEvent(outcome: 'accepted' | 'dismissed'): MockBeforeInstallPromptEvent {
  const event = new Event('beforeinstallprompt') as MockBeforeInstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
  window.dispatchEvent(event);
  return event;
}

describe('PwaInstallService', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as any).matchMedia =
      (window as any).matchMedia ||
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  // Direct instantiation (no TestBed cache) simulates a fresh page load: the
  // constructor's cooldown check must run against the persisted localStorage.
  function freshService(): PwaInstallService {
    return new PwaInstallService();
  }

  it('shows the strip when the browser offers installation', () => {
    const service = freshService();
    expect(service.canInstall()).toBe(false);

    dispatchInstallEvent('accepted');

    expect(service.canInstall()).toBe(true);
  });

  it('records the cooldown when the native install dialog is declined', async () => {
    const service = freshService();
    const event = dispatchInstallEvent('dismissed');

    await service.install();
    expect(event.prompt).toHaveBeenCalled();
    expect(service.canInstall()).toBe(false);

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
    expect(Number.isFinite(dismissedAt)).toBe(true);
    expect(Date.now() - dismissedAt).toBeLessThan(1000);
  });

  it('does not re-show the strip after a declined native dialog within the cooldown', async () => {
    const first = freshService();
    dispatchInstallEvent('dismissed');
    await first.install();

    const second = freshService();
    dispatchInstallEvent('dismissed');

    expect(second.canInstall()).toBe(false);
  });

  it('does not record a cooldown when the install is accepted', async () => {
    const service = freshService();
    dispatchInstallEvent('accepted');

    await service.install();

    expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
  });

  it('starts the cooldown from the Dismiss button', () => {
    const service = freshService();
    dispatchInstallEvent('dismissed');

    service.dismiss();

    expect(Number(localStorage.getItem(DISMISS_KEY))).toBeGreaterThan(0);
    expect(service.canInstall()).toBe(false);
  });

  it('does not offer installation while a previous cooldown is active', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));

    const service = freshService();
    dispatchInstallEvent('dismissed');

    expect(service.canInstall()).toBe(false);
  });

  it('offers installation again once the cooldown has expired', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() - 8 * 24 * 60 * 60 * 1000));

    const service = freshService();
    dispatchInstallEvent('dismissed');

    expect(service.canInstall()).toBe(true);
  });

  // The Settings install card is the permanent fallback: it must see the
  // deferred prompt even while the banner's dismissal cooldown is active.
  it('exposes the prompt to the install card while a cooldown is active', () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));

    const service = freshService();
    dispatchInstallEvent('dismissed');

    expect(service.canInstall()).toBe(false);
    expect(service.hasInstallPrompt()).toBe(true);
  });

  it('keeps the prompt available to the install card after the banner Dismiss button', async () => {
    const service = freshService();
    const event = dispatchInstallEvent('accepted');

    service.dismiss();
    expect(service.canInstall()).toBe(false);
    expect(service.hasInstallPrompt()).toBe(true);

    await service.install();
    expect(event.prompt).toHaveBeenCalled();
    expect(service.hasInstallPrompt()).toBe(false);
  });
});

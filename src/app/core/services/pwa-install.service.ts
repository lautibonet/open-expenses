import { Injectable, signal } from '@angular/core';

const DISMISS_KEY = 'open-expenses_pwa_install_dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  /* Banner-facing availability: false while the dismissal cooldown is active. */
  canInstall = signal(false);
  /* Raw availability, independent of the dismissal cooldown: the Settings
     install card is the permanent fallback and must never be suppressed by it. */
  hasInstallPrompt = signal(false);
  isInstalled = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.hasInstallPrompt.set(true);
      if (!this.isDismissalActive()) {
        this.canInstall.set(true);
      }
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.canInstall.set(false);
      this.hasInstallPrompt.set(false);
      this.deferredPrompt = null;
    });

    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches
    ) {
      this.isInstalled.set(true);
    }
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    this.hasInstallPrompt.set(false);
    if (outcome === 'dismissed') {
      this.rememberDismissal();
    }
    return outcome === 'accepted';
  }

  /* Banner-only dismissal: the deferred prompt stays alive so the Settings
     install card can still offer installation. */
  dismiss(): void {
    this.canInstall.set(false);
    this.rememberDismissal();
  }

  private rememberDismissal(): void {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  private isDismissalActive(): boolean {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;

    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt) || Date.now() - dismissedAt >= DISMISS_TTL_MS) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }

    return true;
  }
}

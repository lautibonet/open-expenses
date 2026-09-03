import { Injectable, signal } from '@angular/core';

const DISMISS_KEY = 'open-expenses_pwa_install_dismissed';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  canInstall = signal(false);
  isInstalled = signal(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    if (this.isDismissalActive()) return;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.canInstall.set(false);
      this.deferredPrompt = null;
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled.set(true);
    }
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
    if (outcome === 'dismissed') {
      this.rememberDismissal();
    }
    return outcome === 'accepted';
  }

  dismiss(): void {
    this.canInstall.set(false);
    this.deferredPrompt = null;
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

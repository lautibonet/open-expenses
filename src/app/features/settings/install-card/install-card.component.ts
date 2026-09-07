import { Component, computed, inject } from '@angular/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-install-card',
  imports: [],
  templateUrl: './install-card.component.html',
  styleUrl: './install-card.component.scss',
})
export class InstallCardComponent {
  pwaInstall = inject(PwaInstallService);
  language = inject(LanguageService);

  /* The card is the permanent home of the install option: shown regardless
     of the banner's dismissal flag or whether the browser has currently
     offered its native prompt — hidden only once the app is installed. */
  visible = computed(() => !this.pwaInstall.isInstalled());

  /* The native prompt only exists after the browser fires beforeinstallprompt. */
  canPromptInstall = computed(() => this.pwaInstall.hasInstallPrompt());

  async install(): Promise<void> {
    await this.pwaInstall.install();
  }
}

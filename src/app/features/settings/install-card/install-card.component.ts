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

  /* Permanent fallback for the dismissible banner: shown whenever the
     browser offers installation and the app is not already installed —
     even if the banner itself was dismissed. */
  visible = computed(
    () => this.pwaInstall.hasInstallPrompt() && !this.pwaInstall.isInstalled(),
  );

  async install(): Promise<void> {
    await this.pwaInstall.install();
  }
}

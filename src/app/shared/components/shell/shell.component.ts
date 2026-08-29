import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { InstallPromptComponent } from '../install-prompt/install-prompt.component';
import { BackupBannerComponent } from '../backup-banner/backup-banner.component';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, InstallPromptComponent, BackupBannerComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  language = inject(LanguageService);

  skipToContent(event: MouseEvent): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }
}

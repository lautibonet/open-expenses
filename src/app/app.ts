import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ProfileService } from './core/services/profile.service';
import { LanguageService } from './core/services/language.service';

/* The landing route (#131): public, reachable without onboarding. */
const PUBLIC_ROOT = '/';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private profileService = inject(ProfileService);
  private languageService = inject(LanguageService);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.languageService.init();
    const completed = await this.profileService.isOnboardingCompleted();
    if (!completed && this.router.url !== PUBLIC_ROOT) {
      this.router.navigate(['/onboarding']);
    }
  }
}

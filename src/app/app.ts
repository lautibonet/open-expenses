import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ProfileService } from './core/services/profile.service';
import { LanguageService } from './core/services/language.service';

/* Public routes (#131, #132): reachable without onboarding. */
const PUBLIC_PATHS = ['/', '/privacy'];

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
    const path = this.router.url.split('?')[0];
    if (!completed && !PUBLIC_PATHS.includes(path)) {
      this.router.navigate(['/onboarding']);
    }
  }
}

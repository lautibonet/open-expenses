import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ProfileService } from './core/services/profile.service';
import { LanguageService } from './core/services/language.service';

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
    if (!completed) {
      this.router.navigate(['/onboarding']);
    } else {
      this.router.navigate(['/movements']);
    }
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ProfileService } from './core/services/profile.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App implements OnInit {
  private profileService = inject(ProfileService);
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    const completed = await this.profileService.isOnboardingCompleted();
    if (!completed) {
      this.router.navigate(['/onboarding']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }
}

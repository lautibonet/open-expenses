import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileService } from './core/services/profile.service';
import { CategoryService } from './core/services/category.service';

@Component({
  selector: 'app-root',
  imports: [],
  template: `<p>Loading...</p>`,
})
export class App implements OnInit {
  private profileService = inject(ProfileService);
  private categoryService = inject(CategoryService);
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

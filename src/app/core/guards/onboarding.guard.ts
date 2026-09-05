import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProfileService } from '../services/profile.service';

export const onboardingGuard: CanActivateFn = async () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);
  const completed = await profileService.isOnboardingCompleted();
  return completed || router.parseUrl('/onboarding');
};

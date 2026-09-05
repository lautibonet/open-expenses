import { Routes } from '@angular/router';
import { ShellComponent } from './shared/components/shell/shell.component';
import { onboardingGuard } from './core/guards/onboarding.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/privacy/privacy.component').then(m => m.PrivacyComponent),
  },
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [onboardingGuard],
    children: [
      {
        path: 'stats',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      { path: 'dashboard', redirectTo: 'stats' },
      {
        path: 'movements',
        loadComponent: () =>
          import('./features/movements/movements.component').then(m => m.MovementsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'movements' },
];

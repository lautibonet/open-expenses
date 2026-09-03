import { Routes } from '@angular/router';
import { ShellComponent } from './shared/components/shell/shell.component';

export const routes: Routes = [
  {
    path: 'onboarding',
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
  },
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'movements', pathMatch: 'full' },
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

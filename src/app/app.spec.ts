import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { ProfileService } from './core/services/profile.service';
import { LanguageService } from './core/services/language.service';

describe('App bootstrap landing', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let profileService: { isOnboardingCompleted: ReturnType<typeof vi.fn> };
  let languageService: { init: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    profileService = { isOnboardingCompleted: vi.fn() };
    languageService = { init: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: ProfileService, useValue: profileService },
        { provide: LanguageService, useValue: languageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  async function createApp(onboardingCompleted: boolean): Promise<void> {
    profileService.isOnboardingCompleted.mockResolvedValue(onboardingCompleted);
    fixture = TestBed.createComponent(App);
    await fixture.componentInstance.ngOnInit();
  }

  it('lands on Movements when onboarding is already completed', async () => {
    await createApp(true);

    expect(languageService.init).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/movements']);
  });

  it('sends first-time users to Onboarding', async () => {
    await createApp(false);

    expect(router.navigate).toHaveBeenCalledWith(['/onboarding']);
  });
});

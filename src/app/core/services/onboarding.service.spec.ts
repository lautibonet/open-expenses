import { TestBed } from '@angular/core/testing';
import { OnboardingService, StagedOnboarding } from './onboarding.service';
import { CategoryService } from './category.service';
import { ProfileService } from './profile.service';
import { db } from '../db/database';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let profileService: ProfileService;

  const staged: StagedOnboarding = {
    baseCurrency: 'usd',
    language: 'es',
    accounts: [{ name: 'Bank', currency: 'USD', balance: 100 }],
    categories: [
      { name: 'Salary', type: 'income' },
      { name: 'Food', type: 'expense' },
    ],
  };

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnboardingService);
    profileService = TestBed.inject(ProfileService);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete();
  });

  it('saves the profile, accounts and categories together', async () => {
    await service.complete(staged);

    const profile = (await profileService.get())!;
    expect(profile.onboardingCompleted).toBe(true);
    expect(profile.baseCurrency).toBe('USD');
    expect(profile.language).toBe('es');
    expect((await db.accounts.toArray()).map(a => a.name)).toEqual(['Bank']);
    expect((await db.categories.toArray()).map(c => c.name)).toEqual(['Salary', 'Food']);
  });

  it('saves nothing when a staged item fails', async () => {
    const categoryService = TestBed.inject(CategoryService);
    const create = categoryService.create.bind(categoryService);
    vi.spyOn(categoryService, 'create').mockImplementation(async (name, type) => {
      if (name === 'Food') throw new Error('disk full');
      return create(name, type);
    });

    await expect(service.complete(staged)).rejects.toThrow('disk full');

    expect(await db.profile.count()).toBe(0);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);
  });

  it('restores a pre-existing profile row when a staged item fails', async () => {
    const before = {
      id: 1,
      baseCurrency: 'EUR',
      language: 'en' as const,
      onboardingCompleted: false,
      lastBackupAt: null,
    };
    await db.profile.add(before);
    vi.spyOn(TestBed.inject(CategoryService), 'create').mockRejectedValue(new Error('disk full'));

    await expect(service.complete(staged)).rejects.toThrow('disk full');

    expect(await profileService.get()).toEqual(before);
    expect(await db.accounts.count()).toBe(0);
  });
});

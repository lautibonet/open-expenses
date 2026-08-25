import { TestBed } from '@angular/core/testing';
import { ProfileService } from './profile.service';
import { db } from '../db/database';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(async () => {
    await db.delete();
    await db.open();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfileService);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should return false when no profile exists', async () => {
    const completed = await service.isOnboardingCompleted();
    expect(completed).toBe(false);
  });

  it('should complete onboarding', async () => {
    const profile = await service.completeOnboarding('EUR');
    expect(profile.onboardingCompleted).toBe(true);
    expect(profile.baseCurrency).toBe('EUR');
  });

  it('should uppercase base currency', async () => {
    const profile = await service.completeOnboarding('eur');
    expect(profile.baseCurrency).toBe('EUR');
  });

  it('should update base currency', async () => {
    await service.completeOnboarding('EUR');
    await service.updateBaseCurrency('USD');
    const currency = await service.getBaseCurrency();
    expect(currency).toBe('USD');
  });

  it('should default to EUR when no profile', async () => {
    const currency = await service.getBaseCurrency();
    expect(currency).toBe('EUR');
  });

  it('should update last backup timestamp', async () => {
    await service.completeOnboarding('EUR');
    const now = new Date();
    await service.updateLastBackupAt(now);
    const profile = await service.get();
    expect(profile!.lastBackupAt).toEqual(now);
  });

  it('should report onboarding completed', async () => {
    await service.completeOnboarding('EUR');
    const completed = await service.isOnboardingCompleted();
    expect(completed).toBe(true);
  });
});

import { Injectable } from '@angular/core';
import { db } from '../db/database';
import { Profile } from '../models/profile.model';
import { DEFAULT_LANGUAGE, Language } from '../types/language.type';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly PROFILE_ID = 1;

  async get(): Promise<Profile | undefined> {
    return db.profile.get(this.PROFILE_ID);
  }

  async isOnboardingCompleted(): Promise<boolean> {
    const profile = await this.get();
    return profile?.onboardingCompleted ?? false;
  }

  async completeOnboarding(
    baseCurrency: string,
    language: Language = DEFAULT_LANGUAGE,
  ): Promise<Profile> {
    let profile = await this.get();
    if (profile) {
      await db.profile.update(this.PROFILE_ID, {
        baseCurrency: baseCurrency.toUpperCase(),
        language,
        onboardingCompleted: true,
      });
    } else {
      profile = {
        id: this.PROFILE_ID,
        baseCurrency: baseCurrency.toUpperCase(),
        language,
        onboardingCompleted: true,
        lastBackupAt: null,
      };
      await db.profile.add(profile);
    }
    return (await db.profile.get(this.PROFILE_ID))!;
  }

  async updateBaseCurrency(currency: string): Promise<void> {
    await db.profile.update(this.PROFILE_ID, {
      baseCurrency: currency.toUpperCase(),
    });
  }

  async updateLastBackupAt(date: Date): Promise<void> {
    await db.profile.update(this.PROFILE_ID, {
      lastBackupAt: date,
    });
  }

  async getBaseCurrency(): Promise<string> {
    const profile = await this.get();
    return profile?.baseCurrency ?? 'EUR';
  }

  async updateLanguage(language: Language): Promise<void> {
    await db.profile.update(this.PROFILE_ID, { language });
  }

  async getLanguage(): Promise<Language> {
    const profile = await this.get();
    return profile?.language ?? DEFAULT_LANGUAGE;
  }
}

import { Injectable, inject } from '@angular/core';
import { db } from '../db/database';
import { CategoryType } from '../models/category.model';
import { Language } from '../types/language.type';
import { AccountService } from './account.service';
import { CategoryService } from './category.service';
import { ProfileService } from './profile.service';

/** What Onboarding has staged by the time the user finishes it. */
export interface StagedOnboarding {
  baseCurrency: string;
  language: Language;
  accounts: { name: string; currency: string; balance: number }[];
  categories: { name: string; type: CategoryType }[];
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private profileService = inject(ProfileService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);

  /* All-or-nothing (#181): the profile, staged accounts and categories
     commit in one transaction. Any failure rolls every write back, so the
     user is never marked onboarded with missing data. */
  async complete(staged: StagedOnboarding): Promise<void> {
    await db.transaction('rw', [db.profile, db.accounts, db.categories], async () => {
      await this.profileService.completeOnboarding(staged.baseCurrency, staged.language);
      for (const acc of staged.accounts) {
        await this.accountService.create(acc.name, acc.currency, acc.balance);
      }
      for (const cat of staged.categories) {
        await this.categoryService.create(cat.name, cat.type);
      }
    });
  }
}

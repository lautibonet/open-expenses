import { Language } from '../types/language.type';

export interface Profile {
  id: number;
  baseCurrency: string;
  language: Language;
  onboardingCompleted: boolean;
  lastBackupAt: Date | null;
}

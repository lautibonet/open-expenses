export interface Profile {
  id: number;
  baseCurrency: string;
  onboardingCompleted: boolean;
  lastBackupAt: Date | null;
}

export declare const DEFAULT_SRC_DIR: string;
export declare const DEFAULT_OUTPUT_FILE: string;
export declare const SHEET_YEAR: number;

export interface AccountSpec {
  name: string;
  initialBalance: number;
}

export interface Account {
  id: number;
  name: string;
  currency: string;
  initialBalance: number;
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: number;
  name: string;
  type: 'Income' | 'Expense';
  active: boolean;
  createdAt: string;
}

export interface Transaction {
  id: number;
  accountId: number;
  categoryId: number;
  amount: number;
  date: string;
  period: string;
  year: number;
  exchangeRate: number | null;
  baseCurrencyAmount: number | null;
  note: string;
  createdAt: string;
}

export interface Transfer {
  id: number;
  sourceAccountId: number;
  destinationAccountId: number;
  sourceAmount: number;
  destinationAmount: number;
  exchangeRate: number;
  baseCurrencyAmount: number;
  date: string;
  period: string;
  year: number;
  note: string;
  createdAt: string;
}

export interface BackupSnapshot {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  transfers: Transfer[];
  profile: Array<{
    id: number;
    baseCurrency: string;
    onboardingCompleted: boolean;
    lastBackupAt: string | null;
  }>;
  exportedAt: string;
}

/** A single row from the sheet's movements.csv, before it becomes a Transaction or a Transfer. */
export interface SheetRow {
  dateCell: string;
  period: string;
  type: 'Ingreso' | 'Salida';
  amount: number;
  category: string;
  account: string;
  comment: string;
}

export interface BuildStats {
  transactions: number;
  transfers: number;
  accounts: number;
  categories: number;
  movements: number;
}

export interface BuildResult {
  snapshot: BackupSnapshot;
  stats: BuildStats;
}

export interface AccountTotalsRow {
  name: string;
  initialBalance: number;
  total: number;
}

export interface CategoryTotalsRow {
  name: string;
  total: number;
}

export interface ReconciliationReport {
  movementCount: number;
  transactionCount: number;
  transferCount: number;
  accountCount: number;
  categoryCount: number;
  accountTotals: AccountTotalsRow[];
  categoryTotals: CategoryTotalsRow[];
}

export function parseCsv(text: string): string[][];
export function parseAccounts(text: string): AccountSpec[];
export function parseCategories(text: string): string[];
export function parseMovements(csvText: string): SheetRow[];
export function parseDate(raw: string): string;
export function buildBackup(
  accountsSpec: AccountSpec[],
  categoriesSpec: string[],
  rows: SheetRow[],
  options?: { exportedAt?: string },
): BuildResult;
export function isBackupShape(value: unknown): boolean;
export function reconciliation(snapshot: BackupSnapshot, movementCount: number): ReconciliationReport;
export function main(argv: string[]): void;

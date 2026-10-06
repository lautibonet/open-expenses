import { Account, isBaseCurrencyAccount } from '../models/account.model';
import { Category } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { PeriodScope } from '../scope/scope';
import { movementInScope } from '../types/period.type';
import { CashBasisLookups, cashBasisLookups } from '../stats/cash-basis';
import { dateToLocalISO } from '../format/local-date';

interface MovementListFilters {
  categoryId: number | null;
  accountId: number | null;
  search: string;
  sortDir: 'desc' | 'asc';
}

/* The Ledger as the screen loaded it — every movement, and every Account and
   Category including Deactivated ones — plus the Scope and the filter state. */
export interface MovementListInput {
  transactions: Transaction[];
  transfers: Transfer[];
  accounts: Account[];
  categories: Category[];
  baseCurrency: string;
  scope: PeriodScope;
  filters: MovementListFilters;
}

interface Money {
  amount: number;
  currency: string;
}

/* The amount a row shows: one figure, or a conversion such as
   `$10.00 → €8.57`. Always positive; formatting is the screen's job. */
export type DisplayAmount =
  | ({ kind: 'single' } & Money)
  | { kind: 'converted'; from: Money; to: Money };

/* A name is null when its Account or Category cannot be resolved. */
export interface TransactionRow {
  kind: 'transaction';
  transaction: Transaction;
  categoryName: string | null;
  accountName: string | null;
  flow: 'income' | 'expense';
  /* ADR 0022: a Card Purchase or card refund, never a counted cash movement. */
  onCard: boolean;
  amount: DisplayAmount;
}

export interface TransferRow {
  kind: 'transfer';
  transfer: Transfer;
  sourceName: string | null;
  destinationName: string | null;
  /* The Payment Category a Card Payment is captured under; null on any other
     Transfer, or when it cannot be resolved. */
  cardPaymentCategoryName: string | null;
  amount: DisplayAmount;
}

export type MovementRow = TransactionRow | TransferRow;

interface MovementDaySection {
  key: string;
  date: Date;
  rows: MovementRow[];
}

export interface MovementList {
  sections: MovementDaySection[];
  rowCount: number;
}

/* The Transaction or Transfer a row shows. */
export function movementOf(row: MovementRow): Transaction | Transfer {
  return row.kind === 'transaction' ? row.transaction : row.transfer;
}

/* A foreign Transaction shows its conversion when one is stored, else its own
   currency only. One on a Base Currency Account, or on an Account that cannot
   be resolved, shows in Base Currency. */
function transactionAmount(
  transaction: Transaction,
  lookups: CashBasisLookups,
  baseCurrency: string,
): DisplayAmount {
  const account = lookups.accountsById.get(transaction.accountId);
  if (!account || isBaseCurrencyAccount(account, baseCurrency)) {
    return { kind: 'single', amount: transaction.amount, currency: baseCurrency };
  }
  const { currency } = account;
  if (transaction.baseCurrencyAmount !== null) {
    return {
      kind: 'converted',
      from: { amount: transaction.amount, currency },
      to: { amount: transaction.baseCurrencyAmount, currency: baseCurrency },
    };
  }
  return { kind: 'single', amount: transaction.amount, currency };
}

/* A cross-currency Transfer shows both legs. A same-currency one shows its
   source amount in Base Currency, even between two foreign Accounts — kept as
   it is by the owner's decision (#187). */
function transferAmount(
  transfer: Transfer,
  lookups: CashBasisLookups,
  baseCurrency: string,
): DisplayAmount {
  const sourceCurrency = lookups.accountsById.get(transfer.sourceAccountId)?.currency ?? '';
  const destinationCurrency =
    lookups.accountsById.get(transfer.destinationAccountId)?.currency ?? '';
  if (sourceCurrency !== destinationCurrency) {
    return {
      kind: 'converted',
      from: { amount: transfer.sourceAmount, currency: sourceCurrency },
      to: { amount: transfer.destinationAmount, currency: destinationCurrency },
    };
  }
  return { kind: 'single', amount: transfer.sourceAmount, currency: baseCurrency };
}

function transactionRow(
  transaction: Transaction,
  lookups: CashBasisLookups,
  baseCurrency: string,
): TransactionRow {
  return {
    kind: 'transaction',
    transaction,
    categoryName: lookups.categoriesById.get(transaction.categoryId)?.name ?? null,
    accountName: lookups.accountsById.get(transaction.accountId)?.name ?? null,
    flow: lookups.isIncome(transaction) ? 'income' : 'expense',
    onCard: lookups.isCreditCardTransaction(transaction),
    amount: transactionAmount(transaction, lookups, baseCurrency),
  };
}

function transferRow(
  transfer: Transfer,
  lookups: CashBasisLookups,
  baseCurrency: string,
): TransferRow {
  return {
    kind: 'transfer',
    transfer,
    sourceName: lookups.accountsById.get(transfer.sourceAccountId)?.name ?? null,
    destinationName: lookups.accountsById.get(transfer.destinationAccountId)?.name ?? null,
    cardPaymentCategoryName:
      transfer.categoryId != null && lookups.isCardPayment(transfer)
        ? (lookups.categoriesById.get(transfer.categoryId)?.name ?? null)
        : null,
    amount: transferAmount(transfer, lookups, baseCurrency),
  };
}

/* Newest date first; same-day movements tie-break by id (creation order) so
   the newest creation sorts first (#172). Ascending is the exact reverse. */
function newestFirst(a: MovementRow, b: MovementRow): number {
  const byDate = movementOf(b).date.getTime() - movementOf(a).date.getTime();
  if (byDate !== 0) return byDate;
  return (movementOf(b).id ?? 0) - (movementOf(a).id ?? 0);
}

/* The category filter hides every Transfer: a Card Payment wears its Payment
   Category as a label, never as a classification. */
function matchesFilters(row: MovementRow, filters: MovementListFilters): boolean {
  const { categoryId, accountId } = filters;
  if (row.kind === 'transaction') {
    if (categoryId !== null && row.transaction.categoryId !== categoryId) return false;
    if (accountId !== null && row.transaction.accountId !== accountId) return false;
  } else {
    if (categoryId !== null) return false;
    if (
      accountId !== null &&
      row.transfer.sourceAccountId !== accountId &&
      row.transfer.destinationAccountId !== accountId
    ) {
      return false;
    }
  }
  const query = filters.search.trim().toLowerCase();
  return !query || matchesSearch(row, query);
}

/* A query matches a row's resolved names and its note. A Card Payment's
   Payment Category is not searched. */
function matchesSearch(row: MovementRow, query: string): boolean {
  const haystack =
    row.kind === 'transaction'
      ? [row.categoryName, row.accountName, row.transaction.note]
      : [row.sourceName, row.destinationName, row.transfer.note];
  return haystack.some(part => part?.toLowerCase().includes(query));
}

/* One section per local day (ADR 0020), in row order so the sort direction
   carries through. */
function byDay(rows: MovementRow[]): MovementDaySection[] {
  const sections: MovementDaySection[] = [];
  const byKey = new Map<string, MovementDaySection>();
  for (const row of rows) {
    const date = movementOf(row).date;
    const key = dateToLocalISO(date);
    let section = byKey.get(key);
    if (!section) {
      section = { key, date, rows: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.rows.push(row);
  }
  return sections;
}

export function movementList(input: MovementListInput): MovementList {
  const { scope } = input;
  const lookups = cashBasisLookups(input.accounts, input.categories);
  const rows: MovementRow[] = [
    ...input.transactions
      .filter(transaction => movementInScope(transaction, scope))
      .map(transaction => transactionRow(transaction, lookups, input.baseCurrency)),
    ...input.transfers
      .filter(transfer => movementInScope(transfer, scope))
      .map(transfer => transferRow(transfer, lookups, input.baseCurrency)),
  ]
    .filter(row => matchesFilters(row, input.filters))
    .sort(newestFirst);
  if (input.filters.sortDir === 'asc') rows.reverse();

  return {
    sections: byDay(rows),
    rowCount: rows.length,
  };
}

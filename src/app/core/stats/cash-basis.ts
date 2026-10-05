import { Account, isCashAccount, isCreditCard } from '../models/account.model';
import { Category, isIncomeCategory } from '../models/category.model';
import { Transaction } from '../models/transaction.model';
import { Transfer } from '../models/transfer.model';
import { storedBaseAmount } from '../balances/period-end-balances';
import {
  MONTH_NUMBERS,
  MonthNumber,
  getPeriodYear,
  movementInScope,
  periodInScope,
  periodIsYearToPeriod,
} from '../types/period.type';
import { MonthScope, PeriodScope } from '../scope/scope';

/* The id-keyed Account lookup every cash-basis predicate expects. Shared so
   each caller builds it the same way (an Account without an id is skipped). */
export function buildAccountsById(accounts: Account[]): Map<number, Account> {
  return new Map(
    accounts.filter(account => account.id != null).map(account => [account.id!, account]),
  );
}

/* ADR 0022: whether a Transaction's spending was paid with credit — it sits on
   a Credit Card. A missing account is treated as cash, the orphan rule the
   cash-basis seam and the spending split share. */
function isCreditCardTransaction(
  transaction: Transaction,
  accountsById: Map<number, Account>,
): boolean {
  const account = accountsById.get(transaction.accountId);
  return account ? isCreditCard(account) : false;
}

/* ADR 0022: the Income, Expenses, and Net figures are cash-basis. A Transaction
   on a Credit Card (a Card Purchase or a card refund) never counts in them —
   card spending reaches Expenses only through a Card Payment. A missing account
   is treated as cash so an orphaned reference is never silently dropped. */
export function countsTowardCashBasis(
  transaction: Transaction,
  accountsById: Map<number, Account>,
): boolean {
  return !isCreditCardTransaction(transaction, accountsById);
}

/* The Transactions that count in the cash-basis KPIs: every one on a Cash
   Account, none on a Credit Card. */
export function cashBasisTransactions(
  transactions: Transaction[],
  accountsById: Map<number, Account>,
): Transaction[] {
  return transactions.filter(transaction => countsTowardCashBasis(transaction, accountsById));
}

/* ADR 0022: the one Transfer kind that reaches the cash-basis KPIs is the Card
   Payment — money leaving a Cash Account to settle a Credit Card. Every other
   kind (Cash to Cash, Card to Cash, Card to Card) never counts. A Transfer
   whose accounts cannot both be resolved is not a Card Payment. */
export function isCardPayment(
  transfer: Transfer,
  accountsById: Map<number, Account>,
): boolean {
  const source = accountsById.get(transfer.sourceAccountId);
  const destination = accountsById.get(transfer.destinationAccountId);
  return !!source && !!destination && isCashAccount(source) && isCreditCard(destination);
}

/* The Transfers that count in the cash-basis KPIs: the Card Payments. */
export function cardPaymentTransfers(
  transfers: Transfer[],
  accountsById: Map<number, Account>,
): Transfer[] {
  return transfers.filter(transfer => isCardPayment(transfer, accountsById));
}

/* The data a cash-basis figure is computed from, as the caller already loaded
   it. `accounts` must include Deactivated ones: a Deactivated Credit Card's
   past purchases still stay out of Income and Expenses. */
export interface CashBasisSnapshot {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  transfers: Transfer[];
  baseCurrency: string;
}

/* Income, Expenses, and Net of one Period of a year, in Base Currency.
   `hasMovements` says whether any cash-basis movement landed in it — the
   Periods that count toward a monthly average. */
export interface PeriodCashFlow {
  period: MonthNumber;
  income: number;
  expenses: number;
  net: number;
  hasMovements: boolean;
}

/* Income, Expenses, and Net summed over an aggregation window, together with
   how many of its Periods carry cash-basis movements. */
export interface CashFlowTotals {
  income: number;
  expenses: number;
  net: number;
  periodsWithMovements: number;
}

export type CashFlowAverages = Omit<CashFlowTotals, 'periodsWithMovements'>;

/* The lookups every caller used to rebuild for itself, and the one
   definition of "is this Transaction income". */
export interface CashBasisLookups {
  accountsById: Map<number, Account>;
  categoriesById: Map<number, Category>;
  isIncome(transaction: Transaction): boolean;
  isCreditCardTransaction(transaction: Transaction): boolean;
  isCardPayment(transfer: Transfer): boolean;
}

export interface CashBasis extends CashBasisLookups {
  /* The twelve Periods of a year, in calendar order. */
  periods(year: number): PeriodCashFlow[];
  /* The Movements figures: a single Period, or a whole year. */
  scopeTotals(scope: PeriodScope): CashFlowTotals;
  /* The Stats figures: January through the Scope's Period of its year. */
  yearToPeriodTotals(scope: MonthScope): CashFlowTotals;
  /* The counted Transactions in a Scope that fell back to their face amount
     for lack of a stored conversion. */
  unconvertedTransactions(scope: PeriodScope): Transaction[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/* ADR 0013, amended by #182: a Transaction on an Account already in the Base
   Currency counts at its face amount — a stored base amount there can only be
   a stale one from an earlier Base Currency. Otherwise the stored base amount
   wins, then the amount at the stored Exchange Rate, then the face amount. */
function transactionBaseAmount(
  transaction: Transaction,
  account: Account | undefined,
  baseCurrency: string,
): number {
  return account?.currency === baseCurrency ? transaction.amount : storedBaseAmount(transaction);
}

/* Whether a Transaction falls back to its face amount inside Base Currency
   sums although its Account holds another currency. An unknown account is
   not flagged: there is no currency to warn about. */
export function isUnconvertedTransaction(
  transaction: Transaction,
  account: Account | undefined,
  baseCurrency: string,
): boolean {
  if (!account || account.currency === baseCurrency) return false;
  return transaction.baseCurrencyAmount == null && transaction.exchangeRate == null;
}

/* ADR 0022: a Card Payment counts as an Expense at its stored amount. That
   amount is not always in Base Currency (#192); this is where the fix lands. */
function cardPaymentBaseAmount(transfer: Transfer): number {
  return transfer.baseCurrencyAmount;
}

/* The lookups alone, for callers that classify movements without totalling
   them. `accounts` and `categories` must include Deactivated ones. */
export function cashBasisLookups(
  accounts: Account[],
  categories: Category[],
): CashBasisLookups {
  const accountsById = buildAccountsById(accounts);
  const categoriesById = new Map(
    categories.filter(c => c.id != null).map(c => [c.id!, c]),
  );
  return {
    accountsById,
    categoriesById,
    isIncome: transaction => isIncomeCategory(categoriesById.get(transaction.categoryId)?.type),
    isCreditCardTransaction: transaction => isCreditCardTransaction(transaction, accountsById),
    isCardPayment: transfer => isCardPayment(transfer, accountsById),
  };
}

/* The cash-basis Income, Expenses, and Net figures (ADR 0022) that the
   Movements net-flow card and the Stats summary both read, so the two screens
   always agree. */
export function cashBasis(snapshot: CashBasisSnapshot): CashBasis {
  const lookups = cashBasisLookups(snapshot.accounts, snapshot.categories);
  const { accountsById, isIncome } = lookups;
  const baseAmount = (transaction: Transaction) =>
    transactionBaseAmount(transaction, accountsById.get(transaction.accountId), snapshot.baseCurrency);
  const counted = cashBasisTransactions(snapshot.transactions, accountsById);
  const cardPayments = cardPaymentTransfers(snapshot.transfers, accountsById);
  const periodsByYear = new Map<number, PeriodCashFlow[]>();

  function periods(year: number): PeriodCashFlow[] {
    const cached = periodsByYear.get(year);
    if (cached) return cached;
    const sums = new Map(
      MONTH_NUMBERS.map(m => [m, { income: 0, expenses: 0, hasMovements: false }]),
    );
    for (const transaction of counted) {
      const sum = sums.get(transaction.period);
      if (!sum || getPeriodYear(transaction) !== year) continue;
      if (isIncome(transaction)) sum.income += baseAmount(transaction);
      else sum.expenses += baseAmount(transaction);
      sum.hasMovements = true;
    }
    for (const payment of cardPayments) {
      const sum = sums.get(payment.period);
      if (!sum || getPeriodYear(payment) !== year) continue;
      sum.expenses += cardPaymentBaseAmount(payment);
      sum.hasMovements = true;
    }
    const result = MONTH_NUMBERS.map(period => {
      const sum = sums.get(period)!;
      const income = round2(sum.income);
      const expenses = round2(sum.expenses);
      return { period, income, expenses, net: round2(income - expenses), hasMovements: sum.hasMovements };
    });
    periodsByYear.set(year, result);
    return result;
  }

  function sumPeriods(year: number, include: (period: MonthNumber) => boolean): CashFlowTotals {
    let income = 0;
    let expenses = 0;
    let periodsWithMovements = 0;
    for (const p of periods(year)) {
      if (!include(p.period)) continue;
      income += p.income;
      expenses += p.expenses;
      if (p.hasMovements) periodsWithMovements++;
    }
    income = round2(income);
    expenses = round2(expenses);
    return { income, expenses, net: round2(income - expenses), periodsWithMovements };
  }

  return {
    ...lookups,
    periods,
    scopeTotals: scope => sumPeriods(scope.year, period => periodInScope(scope.year, period, scope)),
    yearToPeriodTotals: scope =>
      sumPeriods(scope.year, period => periodIsYearToPeriod(scope.year, period, scope)),
    unconvertedTransactions: scope =>
      counted.filter(
        transaction =>
          movementInScope(transaction, scope) &&
          isUnconvertedTransaction(
            transaction,
            accountsById.get(transaction.accountId),
            snapshot.baseCurrency,
          ),
      ),
  };
}

/* Monthly averages over the Periods that carry cash-basis movements; zero
   when none do. */
export function monthlyAverages(totals: CashFlowTotals): CashFlowAverages {
  const months = totals.periodsWithMovements;
  if (months === 0) return { income: 0, expenses: 0, net: 0 };
  return {
    income: round2(totals.income / months),
    expenses: round2(totals.expenses / months),
    net: round2(totals.net / months),
  };
}

import { Account, isCreditCard, paymentCategoryIds } from '../models/account.model';
import { MonthScope } from '../scope/scope';
import { movementInScope } from '../types/period.type';
import { periodEndBalance, periodEndBaseAmount } from '../balances/period-end-balances';
import {
  ConversionDegradation,
  unconvertedTransactionsAffecting,
  unconvertedTransfersAffecting,
} from '../balances/conversion-degradation';
import {
  CashBasisSnapshot,
  CashFlowAverages,
  CashFlowTotals,
  PeriodCashFlow,
  cashBasis,
  monthlyAverages,
} from './cash-basis';
import { AccumulatedInput, accumulatedByPeriod, lastMovementPeriod } from './year-overview';
import { CategorySpending, categorySpending } from './category-spending';

/* The outcome of fetching Exchange Rates for the foreign Account currencies,
   quoted per unit of Base Currency. With no foreign Account the screen passes
   an empty `rates` map; `unavailable` is any fetch that did not return rates
   (offline, failed). */
export type RateOutcome =
  | { kind: 'rates'; rates: Map<string, number> }
  | { kind: 'unavailable' };

/* An Account paired with its Period-end balance, in the account's currency. */
export interface AccountBalance {
  account: Account;
  balance: number;
  /* A card's outstanding debt against its optional Limit, in the card's own
     currency; an overpaid card reads as zero used. Null without a Limit. */
  usedOfLimit: { used: number; limit: number } | null;
}

export interface StatsReport {
  balances: {
    /* Cash Accounts first, then Credit Cards, each group in its stored order. */
    accounts: AccountBalance[];
    /* The Period-end total in Base Currency, debt included (ADR 0013). */
    total: number;
    totalWithoutDebt: number;
    /* The Debt, stated positive; null when no card is in debt. */
    debt: number | null;
  };
  degradation: ConversionDegradation;
  /* Cash-basis Income, Expenses, and Net, January through the Scope Period. */
  kpis: {
    totals: CashFlowTotals;
    averages: CashFlowAverages;
    /* Average Net over average Income, as a whole percentage; null without Income. */
    savingsRate: number | null;
    /* Whether any Period counted carries a cash-basis movement. */
    hasData: boolean;
  };
  yearOverview: {
    periods: PeriodCashFlow[];
    selectedPeriodNet: number;
  };
  balanceStrip: {
    /* The total balance at the end of each Period of the Scope year. */
    accumulated: number[];
    /* The last Period of the Scope year carrying a Movement; 0 when none. */
    frozenFromPeriod: number;
    scopePeriodBalance: number;
    /* Any Movement in the Scope year — cash-basis or not. */
    hasMovements: boolean;
  };
  /* The Scope Period's spending per category. */
  categorySpending: CategorySpending[];
}

/* How the foreign Accounts reach the Base Currency figures:
   - `native`: every Account is already in the Base Currency.
   - `converted`: initial balances converted at the fetched rates; movements
     keep their stored conversions (ADR 0013).
   - `excluded`: a rate is unavailable or missing, so the foreign Accounts are
     left out of the total balance. */
type Conversion =
  | { kind: 'native' }
  | { kind: 'converted'; initialsInBase: Map<number, number> }
  | { kind: 'excluded' };

const round2 = (value: number) => Math.round(value * 100) / 100;

/* The foreign Account currencies the total balance needs an Exchange Rate for. */
export function currenciesNeedingRates(snapshot: CashBasisSnapshot): string[] {
  return [
    ...new Set(
      snapshot.accounts.map(a => a.currency).filter(c => c !== snapshot.baseCurrency),
    ),
  ];
}

/* Every figure the Stats screen shows for a Scope, from the recorded data and
   the outcome of the Exchange Rate fetch. */
export function statsReport(
  snapshot: CashBasisSnapshot,
  scope: MonthScope,
  rates: RateOutcome,
): StatsReport {
  const figures = cashBasis(snapshot);
  const { accountsById, isIncome } = figures;
  const base = snapshot.baseCurrency;
  const conversion = resolveConversion(snapshot, rates);
  const balanceInput = (account: Account) => ({
    account,
    transactions: snapshot.transactions,
    transfers: snapshot.transfers,
    isIncome,
  });

  const accounts = cashAccountsFirst(
    snapshot.accounts.map(account => {
      const balance = periodEndBalance(balanceInput(account), scope);
      return { account, balance, usedOfLimit: usedOfLimit(account, balance) };
    }),
  );

  const baseAmounts = new Map<Account, number>();
  for (const { account, balance } of accounts) {
    if (conversion.kind === 'converted') {
      baseAmounts.set(
        account,
        periodEndBaseAmount(balanceInput(account), scope, conversion.initialsInBase.get(account.id!)!),
      );
    } else if (countsInTotal(account, conversion, base)) {
      baseAmounts.set(account, balance);
    }
  }

  const totals = figures.yearToPeriodTotals(scope);
  const averages = monthlyAverages(totals);
  const periods = figures.periods(scope.year);
  const accumulated = accumulatedByPeriod({
    accounts: snapshot.accounts,
    transactions: snapshot.transactions,
    transfers: snapshot.transfers,
    isIncome,
    year: scope.year,
    ...accumulatedInitials(snapshot, conversion),
  });
  const frozenFromPeriod = lastMovementPeriod(snapshot.transactions, snapshot.transfers, scope.year);

  return {
    balances: { accounts, ...totalBalance(baseAmounts) },
    degradation: {
      accountsExcluded: conversion.kind === 'excluded',
      unconvertedMovements:
        unconvertedTransactionsAffecting(snapshot.transactions, accountsById, base, scope).length > 0
        || unconvertedTransfersAffecting(snapshot.transfers, accountsById, scope).length > 0,
    },
    kpis: {
      totals,
      averages,
      savingsRate: averages.income > 0 ? Math.round((averages.net / averages.income) * 100) : null,
      hasData: totals.periodsWithMovements > 0,
    },
    yearOverview: {
      periods,
      selectedPeriodNet: periods.find(p => p.period === scope.period)?.net ?? 0,
    },
    balanceStrip: {
      accumulated,
      frozenFromPeriod,
      scopePeriodBalance: accumulated[scope.period - 1] ?? 0,
      hasMovements: [...snapshot.transactions, ...snapshot.transfers].some(m =>
        movementInScope(m, { kind: 'year', year: scope.year }),
      ),
    },
    categorySpending: categorySpending(
      snapshot.transactions.filter(t => movementInScope(t, scope)),
      figures,
      paymentCategoryIds(snapshot.accounts),
    ),
  };
}

/* Accumulated evaluates the total-balance formula at every Period, so it
   takes the same Accounts and amounts the total does: converted initials,
   or — degraded — the Base Currency Accounts alone at face amounts. */
function accumulatedInitials(
  snapshot: CashBasisSnapshot,
  conversion: Conversion,
): Pick<AccumulatedInput, 'initialInBase' | 'nativeAmounts'> {
  if (conversion.kind === 'converted') {
    return { initialInBase: conversion.initialsInBase, nativeAmounts: false };
  }
  const included = snapshot.accounts.filter(a => countsInTotal(a, conversion, snapshot.baseCurrency));
  return {
    initialInBase: new Map(included.map(a => [a.id!, a.initialBalance])),
    nativeAmounts: conversion.kind === 'excluded',
  };
}

/* Whether an Account counts in the total balance and the Accumulated line
   alike: every Account once converted, only the Base Currency ones when a
   rate could not be resolved. */
function countsInTotal(account: Account, conversion: Conversion, baseCurrency: string): boolean {
  return conversion.kind !== 'excluded' || account.currency === baseCurrency;
}

function resolveConversion(snapshot: CashBasisSnapshot, rates: RateOutcome): Conversion {
  const foreign = currenciesNeedingRates(snapshot);
  if (foreign.length === 0) return { kind: 'native' };
  if (rates.kind === 'unavailable' || foreign.some(c => !rates.rates.has(c))) {
    return { kind: 'excluded' };
  }
  const initialsInBase = new Map<number, number>();
  for (const account of snapshot.accounts) {
    initialsInBase.set(
      account.id!,
      account.currency === snapshot.baseCurrency
        ? account.initialBalance
        : round2(account.initialBalance / rates.rates.get(account.currency)!),
    );
  }
  return { kind: 'converted', initialsInBase };
}

/* The total balance and the Debt, from the Base Currency amount of every
   Account that made it into the total. The Debt is the sum of the negative
   Credit Card balances, stated as a positive figure; an overpaid card's
   positive balance lands in the total, never in the Debt (GLOSSARY.md, Credit
   Card). Counting only the Accounts in the total keeps a degraded conversion
   from splitting the two figures. */
function totalBalance(
  baseAmounts: Map<Account, number>,
): Omit<StatsReport['balances'], 'accounts'> {
  let total = 0;
  let debt = 0;
  let hasDebt = false;
  for (const [account, amount] of baseAmounts) {
    total += amount;
    if (isCreditCard(account) && amount < 0) {
      hasDebt = true;
      debt -= amount;
    }
  }
  total = round2(total);
  debt = round2(debt);
  return {
    total,
    totalWithoutDebt: round2(total + debt),
    debt: hasDebt ? debt : null,
  };
}

function usedOfLimit(account: Account, balance: number): AccountBalance['usedOfLimit'] {
  if (!isCreditCard(account) || account.limit == null) return null;
  return { used: Math.max(0, -balance), limit: account.limit };
}

/* Cards are grouped after Cash Accounts in the balance list (GLOSSARY.md,
   Stats). The sort is stable, so each group keeps its accounts' own order. */
function cashAccountsFirst(balances: AccountBalance[]): AccountBalance[] {
  return [...balances].sort(
    (a, b) => Number(isCreditCard(a.account)) - Number(isCreditCard(b.account)),
  );
}

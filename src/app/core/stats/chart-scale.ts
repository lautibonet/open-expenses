import { PeriodCashFlow } from './cash-basis';
import { CategorySpending } from './category-spending';

/* A graph track's two extremes around the zero line: the largest figure that
   grows up from it and the largest magnitude that grows below it. */
export interface Extremes {
  up: number;
  down: number;
}

/* What the balance strip's scale edge is worth: the year's highest balance,
   or — when the deepest overdrawn balance is the larger magnitude — that
   balance, signed. */
export interface ScaleAnchor {
  kind: 'top' | 'overdrawn';
  amount: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/* The zero line both graphs share positions itself from the Scope year's
   data: its height in the track equals the year's negative share of its
   extremes. An all-positive year pins the line to the bottom edge and gives
   the fills the full height; an overdrawn year raises it in proportion, so
   the tallest figure above reaches the top edge and the deepest below
   reaches the bottom edge. */
export function zeroPct({ up, down }: Extremes): number {
  if (up + down <= 0) return 0;
  return Math.round((down / (up + down)) * 10000) / 100;
}

/* A figure's fill height, as a percentage of the track, growing up from the
   zero line when positive and down from it when negative. */
export function fillPct(value: number, extremes: Extremes): number {
  const zero = zeroPct(extremes);
  if (value > 0 && extremes.up > 0) {
    return round2((value / extremes.up) * (100 - zero));
  }
  if (value < 0 && extremes.down > 0) {
    return round2((-value / extremes.down) * zero);
  }
  return 0;
}

/* Year overview extremes: up is the largest figure among Income, Expenses
   and positive Net; down is the deepest overdrawn Net. Income and Expenses
   are magnitudes and never grow below the line — only a negative Net does. */
export function overviewExtremes(periods: PeriodCashFlow[]): Extremes {
  let up = 0;
  let down = 0;
  for (const p of periods) {
    up = Math.max(up, p.income, p.expenses, p.net);
    down = Math.max(down, -p.net);
  }
  return { up, down };
}

/* Balance strip extremes: the year's highest balance above the line and the
   deepest overdrawn balance below it. */
export function balanceExtremes(accumulated: number[]): Extremes {
  let up = 0;
  let down = 0;
  for (const balance of accumulated) {
    if (balance > 0) up = Math.max(up, balance);
    else down = Math.max(down, -balance);
  }
  return { up, down };
}

export function stripScaleAnchor(accumulated: number[]): ScaleAnchor {
  const { up, down } = balanceExtremes(accumulated);
  return down > up ? { kind: 'overdrawn', amount: -down } : { kind: 'top', amount: up };
}

/* A category bar's length, as a percentage of the largest category's. */
export function categoryBarWidth(total: number, breakdown: CategorySpending[]): number {
  const max = breakdown.length > 0 ? Math.max(...breakdown.map(b => b.total)) : 0;
  if (max <= 0) return 0;
  return Math.round((total / max) * 10000) / 100;
}

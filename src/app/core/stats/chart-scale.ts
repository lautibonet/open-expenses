import { PeriodCashFlow } from './cash-basis';
import { Period } from '../types/period.type';
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

/* The zero line both graphs share positions itself from the charted
   Periods' data (exactly the Scope's, ADR 0030): its height in the
   track equals their negative share of their extremes. All-positive data
   pins the line to the bottom edge and gives the fills the full height;
   overdrawn data raises it in proportion, so
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

/* Net chart extremes: up is the largest figure among Income, Expenses
   and positive Net; down is the deepest overdrawn Net. Income and Expenses
   are magnitudes and never grow below the line — only a negative Net does. */
export function netChartExtremes(periods: PeriodCashFlow[]): Extremes {
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

/* A year label under a chart: the year of a charted January, its 1-based
   column, and whether that January is the last column, where the label runs
   left to stay inside the card. */
export interface YearMark {
  year: number;
  column: number;
  atEnd: boolean;
}

/* ADR 0030: a chart crossing a year boundary labels each January with its
   year; one inside a single year needs no labels. */
export function yearMarks(periods: Period[]): YearMark[] {
  if (periods.length === 0 || periods[0].year === periods[periods.length - 1].year) return [];
  return periods.flatMap((period, i) =>
    period.month === 1 ? [{ year: period.year, column: i + 1, atEnd: i === periods.length - 1 }] : [],
  );
}

import { Period } from '../types/period.type';

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

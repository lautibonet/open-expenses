import {
  MONTH_NUMBERS,
  MonthNumber,
  Period,
  ScopeAwareMovement,
  comparePeriods,
  getCurrentPeriod,
  getCurrentYear,
  getPeriodYear,
  isMonthNumber,
  isValidYear,
  movementPeriod,
  samePeriod,
  shiftPeriod,
} from '../types/period.type';

/* The reporting window of the Stats and Movements screens (GLOSSARY.md, ADR
   0029): a run of consecutive Periods from its From Period to its To Period,
   which may cross a year boundary. A one-Period Scope has From = To. */
export interface Scope {
  from: Period;
  to: Period;
}

/* Presets only fill in a From/To pair; they are not a kind of Scope. */
export type ScopePreset = 'thisPeriod' | 'last3' | 'last6' | 'last12' | 'yearToDate' | 'wholeYear';
export type ScopePresetChoice = ScopePreset | 'custom';

/* The presets in the order the select offers them. */
export const SCOPE_PRESETS: ScopePreset[] = [
  'thisPeriod',
  'last3',
  'last6',
  'last12',
  'yearToDate',
  'wholeYear',
];

/* The order in which an edited Scope is matched against the presets: the
   calendar-year presets before the rolling "Last N" runs, and "Whole year"
   before "Year to date", which produces the same January → December run
   for a past year. */
const MATCHING_ORDER: ScopePreset[] = [
  'thisPeriod',
  'wholeYear',
  'yearToDate',
  'last3',
  'last6',
  'last12',
];

const ROLLING_LENGTH: Partial<Record<ScopePreset, number>> = {
  thisPeriod: 1,
  last3: 3,
  last6: 6,
  last12: 12,
};

export function singlePeriodScope(period: Period): Scope {
  return { from: period, to: period };
}

export function sameScope(a: Scope, b: Scope): boolean {
  return samePeriod(a.from, b.from) && samePeriod(a.to, b.to);
}

/* Whether the Scope covers more than one Period. */
export function isMultiPeriod(scope: Scope): boolean {
  return !samePeriod(scope.from, scope.to);
}

/* The latest Period with movements, or null when nothing is recorded. */
export function latestPeriodWithMovements(movements: ScopeAwareMovement[]): Period | null {
  let latest: Period | null = null;
  for (const movement of movements) {
    const period = movementPeriod(movement);
    if (period && (latest === null || comparePeriods(period, latest) > 0)) {
      latest = period;
    }
  }
  return latest;
}

/* Issue #216: Scopes anchor on the latest Period with movements — even one
   ahead of the calendar, since a Period is the user's own convention — and
   on the current Period when nothing is recorded. */
function anchorPeriod(movements: ScopeAwareMovement[]): Period {
  return latestPeriodWithMovements(movements) ?? { year: getCurrentYear(), month: getCurrentPeriod() };
}

/* Movements opens on the one-Period Scope at the anchor. */
export function defaultScope(movements: ScopeAwareMovement[] = []): Scope {
  return singlePeriodScope(anchorPeriod(movements));
}

/* Stats opens on Year to date ending at the anchor. */
export function defaultStatsScope(movements: ScopeAwareMovement[] = []): Scope {
  const anchor = anchorPeriod(movements);
  return { from: { year: anchor.year, month: 1 }, to: anchor };
}

/* The From/To pair a preset fills in. The rolling presets count back from
   the anchor; "Whole year" and "Year to date" follow the To Period's year. */
export function presetScope(
  preset: ScopePreset,
  scope: Scope,
  movements: ScopeAwareMovement[],
): Scope {
  const anchor = anchorPeriod(movements);
  const length = ROLLING_LENGTH[preset];
  if (length !== undefined) {
    return { from: shiftPeriod(anchor, -(length - 1)), to: anchor };
  }
  const year = scope.to.year;
  const from: Period = { year, month: 1 };
  if (preset === 'wholeYear') {
    return { from, to: { year, month: 12 } };
  }
  return { from, to: yearToDateEnd(year, anchor) };
}

/* "Year to date" runs to the latest Period with movements in that year, or
   to December for a past year. A later year holds no movements yet: it runs
   to the current Period when it is the current year, else to January. */
function yearToDateEnd(year: number, anchor: Period): Period {
  if (year < anchor.year) return { year, month: 12 };
  if (year === anchor.year) return anchor;
  return { year, month: year === getCurrentYear() ? getCurrentPeriod() : 1 };
}

/* The preset whose From/To the Scope matches exactly, or Custom. When
   several match, the preferred one (the preset last chosen) wins. */
export function matchingPreset(
  scope: Scope,
  movements: ScopeAwareMovement[],
  preferred?: ScopePresetChoice | null,
): ScopePresetChoice {
  const matches = (preset: ScopePreset) => sameScope(presetScope(preset, scope, movements), scope);
  if (preferred && preferred !== 'custom' && matches(preferred)) {
    return preferred;
  }
  return MATCHING_ORDER.find(matches) ?? 'custom';
}

/* Picking a From after the To moves the To to match; Scopes have no maximum
   length. */
export function changeFrom(scope: Scope, from: Period): Scope {
  return { from, to: comparePeriods(from, scope.to) > 0 ? from : scope.to };
}

/* Picking a To before the From moves the From to match. */
export function changeTo(scope: Scope, to: Period): Scope {
  return { from: comparePeriods(to, scope.from) < 0 ? to : scope.from, to };
}

function periodParam(period: Period): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function parsePeriodParam(value: string | null): Period | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return isValidYear(year) && isMonthNumber(month) ? { year, month } : null;
}

/* The Movements URL carries the Scope as `?from=YYYY-MM&to=YYYY-MM`. */
export function scopeQuery(scope: Scope): string {
  return `from=${periodParam(scope.from)}&to=${periodParam(scope.to)}`;
}

/* The Scope a URL query names, or null when it names none. Old
   `?period=<1-12|all>&year=YYYY` links keep resolving to the same Scope. */
export function scopeFromQuery(params: URLSearchParams): Scope | null {
  if (params.has('from') || params.has('to')) {
    const from = parsePeriodParam(params.get('from'));
    const to = parsePeriodParam(params.get('to'));
    if (!from || !to) return null;
    return comparePeriods(from, to) <= 0 ? { from, to } : { from: to, to: from };
  }
  return legacyScopeFromQuery(params);
}

function legacyScopeFromQuery(params: URLSearchParams): Scope | null {
  const periodParam = params.get('period');
  const year = Number(params.get('year'));
  if (!isValidYear(year)) {
    return null;
  }
  if (periodParam === 'all') {
    return { from: { year, month: 1 }, to: { year, month: 12 } };
  }
  const month = Number(periodParam);
  return isMonthNumber(month) ? singlePeriodScope({ year, month }) : null;
}

export interface ScopeOptions {
  years: number[];
  months: MonthNumber[];
}

/* Issue #218: every month is on offer for any year — a Period without
   movements shows as empty, never snaps elsewhere. The years on offer run
   without gaps from the earliest year with data (or the From year) to the
   latest of the current year, the latest year with data, and the To year,
   so a deep-linked Scope stays put. */
export function scopeOptions(movements: ScopeAwareMovement[], scope: Scope): ScopeOptions {
  let first = Math.min(getCurrentYear(), scope.from.year);
  let last = Math.max(getCurrentYear(), scope.to.year);
  for (const movement of movements) {
    const year = getPeriodYear(movement);
    first = Math.min(first, year);
    last = Math.max(last, year);
  }
  return {
    years: Array.from({ length: last - first + 1 }, (_, i) => first + i),
    months: [...MONTH_NUMBERS],
  };
}

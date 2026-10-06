import { describe, it, expect } from 'vitest';
import {
  balanceExtremes,
  categoryBarWidth,
  fillPct,
  overviewExtremes,
  stripScaleAnchor,
  zeroPct,
} from './chart-scale';
import { PeriodCashFlow } from './cash-basis';
import { CategorySpending } from './category-spending';

function period(overrides: Partial<PeriodCashFlow>): PeriodCashFlow {
  return { period: 1, income: 0, expenses: 0, net: 0, hasMovements: false, ...overrides };
}

function spending(total: number): CategorySpending {
  return { categoryId: 1, name: 'Food', cash: total, credit: 0, total };
}

describe('zero line', () => {
  it('pins to the bottom edge for an all-positive track', () => {
    expect(zeroPct({ up: 500, down: 0 })).toBe(0);
  });

  it('rises to the overdrawn share of the extremes', () => {
    expect(zeroPct({ up: 300, down: 100 })).toBe(25);
  });

  it('stays at the bottom for an empty track', () => {
    expect(zeroPct({ up: 0, down: 0 })).toBe(0);
  });
});

describe('fill heights', () => {
  it('fills the full height above an all-positive line', () => {
    expect(fillPct(500, { up: 500, down: 0 })).toBe(100);
    expect(fillPct(125, { up: 500, down: 0 })).toBe(25);
  });

  it('shares the height between the two sides of a raised line', () => {
    /* The line sits at 25%: the tallest figure reaches the top, the deepest the bottom. */
    expect(fillPct(300, { up: 300, down: 100 })).toBe(75);
    expect(fillPct(-100, { up: 300, down: 100 })).toBe(25);
    expect(fillPct(-50, { up: 300, down: 100 })).toBe(12.5);
  });

  it('draws nothing for zero, or for a side the track has no room for', () => {
    expect(fillPct(0, { up: 300, down: 100 })).toBe(0);
    expect(fillPct(-10, { up: 300, down: 0 })).toBe(0);
  });
});

describe('year overview extremes', () => {
  it('takes the largest Income, Expenses, or positive Net above the line, and the deepest Net below', () => {
    const periods = [
      period({ period: 1, income: 1000, expenses: 400, net: 600 }),
      period({ period: 2, income: 200, expenses: 1500, net: -1300 }),
    ];

    expect(overviewExtremes(periods)).toEqual({ up: 1500, down: 1300 });
  });

  it('has no overdrawn side when every Net is positive', () => {
    expect(overviewExtremes([period({ income: 10, expenses: 5, net: 5 })])).toEqual({ up: 10, down: 0 });
  });
});

describe('balance strip extremes and scale anchor', () => {
  it('takes the highest balance above the line and the deepest overdrawn balance below', () => {
    expect(balanceExtremes([100, -40, 250, -10])).toEqual({ up: 250, down: 40 });
  });

  it('anchors the scale at the highest balance', () => {
    expect(stripScaleAnchor([100, -40, 250])).toEqual({ kind: 'top', amount: 250 });
  });

  it('anchors the scale at the overdrawn balance, signed, when it is the larger magnitude', () => {
    expect(stripScaleAnchor([100, -400, 250])).toEqual({ kind: 'overdrawn', amount: -400 });
  });
});

describe('category bar width', () => {
  it('scales each bar against the largest category', () => {
    const rows = [spending(400), spending(100), spending(1 / 3 * 400)];

    expect(categoryBarWidth(400, rows)).toBe(100);
    expect(categoryBarWidth(100, rows)).toBe(25);
    expect(categoryBarWidth(400 / 3, rows)).toBe(33.33);
  });

  it('is zero with no spending', () => {
    expect(categoryBarWidth(0, [])).toBe(0);
  });
});

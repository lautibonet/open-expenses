import { describe, expect, it } from 'vitest';
import { isNameTaken, namesMatch } from './name-uniqueness';

describe('namesMatch', () => {
  it('matches names that differ only by letter case', () => {
    expect(namesMatch('Visa', 'visa')).toBe(true);
    expect(namesMatch('VISA', 'Visa')).toBe(true);
  });

  it('ignores surrounding whitespace, as the services trim before storing', () => {
    expect(namesMatch('  Visa ', 'visa')).toBe(true);
  });

  it('does not match different names', () => {
    expect(namesMatch('Visa', 'Amex')).toBe(false);
    expect(namesMatch('Visa', 'Visa payment')).toBe(false);
  });
});

describe('isNameTaken', () => {
  const items = [
    { id: 1, name: 'Cash' },
    { id: 2, name: 'Visa' },
  ];

  it('is taken by another item with a different capitalisation', () => {
    expect(isNameTaken(items, 'CASH')).toBe(true);
  });

  it('is free when no item carries the name', () => {
    expect(isNameTaken(items, 'Amex')).toBe(false);
  });

  it('lets an item keep its own name under a different capitalisation', () => {
    expect(isNameTaken(items, 'visa', (item) => item.id === 2)).toBe(false);
    expect(isNameTaken(items, 'visa', (item) => item.id === 1)).toBe(true);
  });
});

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseMoneyInput(input: string): number {
  const cleaned = input.replace(/[^0-9.,\-]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return value;
}

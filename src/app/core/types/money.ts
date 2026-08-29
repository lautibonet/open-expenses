export function parseMoneyInput(input: string): number {
  const cleaned = input.replace(/[^0-9.,\-]/g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  if (isNaN(value)) return 0;
  return value;
}

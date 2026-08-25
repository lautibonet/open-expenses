import { Injectable } from '@angular/core';

const FRANKFURTER_BASE = 'https://api.frankfurter.dev';

export interface ExchangeRateResult {
  rate: number;
  from: string;
  to: string;
  date: string;
}

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  async getRate(from: string, to: string, date?: string): Promise<ExchangeRateResult> {
    const fromCurrency = from.toUpperCase();
    const toCurrency = to.toUpperCase();

    if (fromCurrency === toCurrency) {
      return { rate: 1, from: fromCurrency, to: toCurrency, date: date ?? this.formatDate(new Date()) };
    }

    const dateStr = date ?? 'latest';
    const url = `${FRANKFURTER_BASE}/${dateStr}?from=${fromCurrency}&to=${toCurrency}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Exchange rate API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const rate = data.rates?.[toCurrency];
    if (rate === undefined) {
      throw new Error(`Rate not available for ${toCurrency}`);
    }

    return {
      rate,
      from: fromCurrency,
      to: toCurrency,
      date: data.date ?? this.formatDate(new Date()),
    };
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}

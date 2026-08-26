import { Injectable, inject } from '@angular/core';
import { NetworkService } from './network.service';
import { OfflineError } from '../models/offline-error';

const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v2';

export interface ExchangeRateResult {
  rate: number;
  from: string;
  to: string;
  date: string;
}

interface FrankfurterResponse {
  base: string;
  quote: string;
  date: string;
  rate: number;
}

export interface BatchExchangeRateResult {
  base: string;
  date: string;
  rates: Map<string, number>;
}

interface FrankfurterBatchResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private networkService = inject(NetworkService);

  async getRate(from: string, to: string, date?: string): Promise<ExchangeRateResult> {
    const fromCurrency = from.toUpperCase();
    const toCurrency = to.toUpperCase();

    if (fromCurrency === toCurrency) {
      return { rate: 1, from: fromCurrency, to: toCurrency, date: date ?? this.formatDate(new Date()) };
    }

    if (!this.networkService.isOnline()) {
      throw new OfflineError();
    }

    let url = `${FRANKFURTER_BASE}/rate/${fromCurrency}/${toCurrency}`;
    if (date) {
      url += `?date=${date}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Exchange rate API failed: ${response.statusText}`);
    }

    const data: FrankfurterResponse = await response.json();
    if (!data?.rate) {
      throw new Error(`Rate not available for ${toCurrency}`);
    }

    return {
      rate: data.rate,
      from: fromCurrency,
      to: toCurrency,
      date: data.date ?? this.formatDate(new Date()),
    };
  }

  async getRates(base: string, quotes: string[], date?: string): Promise<BatchExchangeRateResult> {
    if (quotes.length === 0) {
      throw new Error('At least one quote currency is required');
    }

    const baseCurrency = base.toUpperCase();
    const quoteCurrencies = quotes.map(q => q.toUpperCase()).filter(q => q !== baseCurrency);

    if (quoteCurrencies.length === 0) {
      const rates = new Map<string, number>([[baseCurrency, 1]]);
      return { base: baseCurrency, date: date ?? this.formatDate(new Date()), rates };
    }

    if (!this.networkService.isOnline()) {
      throw new OfflineError();
    }

    let url = `${FRANKFURTER_BASE}/rates?base=${baseCurrency}&quotes=${quoteCurrencies.join(',')}`;
    if (date) {
      url += `&date=${date}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Exchange rate API failed: ${response.statusText}`);
    }

    const data: FrankfurterBatchResponse = await response.json();
    if (!data?.rates || Object.keys(data.rates).length === 0) {
      throw new Error('No rates returned');
    }

    const rates = new Map<string, number>(Object.entries(data.rates));
    if (quoteCurrencies.includes(baseCurrency)) {
      rates.set(baseCurrency, 1);
    }

    return {
      base: baseCurrency,
      date: data.date ?? this.formatDate(new Date()),
      rates,
    };
  }

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}

import { Injectable, inject } from '@angular/core';
import { NetworkService } from './network.service';
import { OfflineError } from '../models/offline-error';
import { TranslationError } from '../models/translation-error';
import { dateToLocalISO } from '../format/local-date';

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

@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private networkService = inject(NetworkService);
  private rateCache = new Map<string, BatchExchangeRateResult>();

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
      throw new TranslationError('errors.rateApiFailed', { status: response.statusText });
    }

    const data: FrankfurterResponse = await response.json();
    if (!data?.rate) {
      throw new TranslationError('errors.rateNotAvailable', { currency: toCurrency });
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
      throw new TranslationError('errors.quoteCurrenciesRequired');
    }

    const baseCurrency = base.toUpperCase();
    const quoteCurrencies = quotes.map(q => q.toUpperCase()).filter(q => q !== baseCurrency);

    if (quoteCurrencies.length === 0) {
      const rates = new Map<string, number>([[baseCurrency, 1]]);
      return { base: baseCurrency, date: date ?? this.formatDate(new Date()), rates };
    }

    const cacheKey = `${baseCurrency}-${quoteCurrencies.join(',')}-${date ?? 'latest'}`;
    const cached = this.rateCache.get(cacheKey);
    if (cached) {
      return cached;
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
      throw new TranslationError('errors.rateApiFailed', { status: response.statusText });
    }

    const data: FrankfurterResponse[] = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new TranslationError('errors.noRatesReturned');
    }

    const rates = new Map<string, number>();
    for (const entry of data) {
      rates.set(entry.quote, entry.rate);
    }

    const result: BatchExchangeRateResult = {
      base: baseCurrency,
      date: data[0].date ?? this.formatDate(new Date()),
      rates,
    };

    this.rateCache.set(cacheKey, result);
    return result;
  }

  private formatDate(d: Date): string {
    return dateToLocalISO(d);
  }
}

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

  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}

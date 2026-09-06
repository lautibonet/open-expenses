import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { OfflineError } from '../../../core/models/offline-error';
import { LanguageService } from '../../../core/services/language.service';

export interface RateState {
  loading: boolean;
  error: string;
  rate: number | null;
  date: string;
}

/**
 * A rate captured outside a fetch (edit prefill, cross-form draft restore).
 * The well adopts it as-is instead of fetching; the next change of the
 * currency pair or date triggers a fresh fetch.
 */
export interface RateSeed {
  rate: number | null;
  date: string;
  error?: string;
}

/**
 * The Suggested Rate (CONTEXT.md): the rate fetched for the currency pair
 * and the movement's date. A manual rate is an override and never becomes
 * the suggestion.
 */
export interface SuggestedRate {
  rate: number;
  date: string;
}

/**
 * Translation keys the well renders. Parents keep their own namespaces
 * (the Transaction Form and the Transfer Form keep their existing copy).
 */
export interface ExchangeRateWellLabels {
  heading: string;
  fetching: string;
  equivalent: string;
  suggested: string;
  rateAria?: string;
  equivalentAria?: string;
  errorOffline: string;
  errorFetch: string;
}

@Component({
  selector: 'app-exchange-rate-well',
  imports: [FormsModule],
  templateUrl: './exchange-rate-well.component.html',
  styleUrl: './exchange-rate-well.component.scss',
})
export class ExchangeRateWellComponent {
  private exchangeRateService = inject(ExchangeRateService);
  language = inject(LanguageService);

  /** Source currency; empty when no account is selected yet. */
  from = input.required<string>();
  /** Target currency; empty when no account is selected yet. */
  to = input.required<string>();
  /** Transaction date — selects the historical rate. */
  date = input('');
  /** Stored/restored rate to show instead of fetching. */
  seed = input<RateSeed | null>(null);
  /** Converted amount computed by the hosting form (readonly display). */
  equivalent = input<number | null>(null);
  labels = input.required<ExchangeRateWellLabels>();

  /** Full rate state; the hosting form gates saving on it. */
  stateChange = output<RateState>();

  state = signal<RateState>({ loading: false, error: '', rate: null, date: '' });

  /**
   * The Suggested Rate: the rate last fetched (or seeded) for the currency
   * pair and date. Manual typing overrides the input's rate without ever
   * touching the suggestion — only a pair/date change (or seed) replaces it.
   */
  suggestion = signal<SuggestedRate | null>(null);

  visible = computed(
    () => !!this.from() && !!this.to() && this.from() !== this.to(),
  );

  private lastSeed: RateSeed | null = null;
  private lastHandled: { from: string; to: string; date: string } | null = null;
  private fetchSeq = 0;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
    effect(() => this.reconcileRateInputs(this.from(), this.to(), this.date(), this.seed()));
  }

  rateAriaLabel(): string | null {
    const key = this.labels().rateAria;
    return key ? this.language.t(key) : null;
  }

  equivalentAriaLabel(): string | null {
    const key = this.labels().equivalentAria;
    return key ? this.language.t(key, { currency: this.to() }) : null;
  }

  onRateInput(value: number | null): void {
    // +null === 0: mirrors the forms' historic +$event coercion.
    this.apply({ ...this.state(), rate: +(value ?? 0) });
  }

  private reconcileRateInputs(
    from: string,
    to: string,
    date: string,
    seed: RateSeed | null,
  ): void {
    if (!from || !to || from === to) {
      this.lastSeed = seed;
      this.lastHandled = { from, to, date };
      this.suggestion.set(null);
      this.apply({ loading: false, error: '', rate: null, date: '' });
      return;
    }

    if (seed && seed !== this.lastSeed) {
      this.lastSeed = seed;
      this.lastHandled = { from, to, date };
      this.suggestion.set(seed.rate !== null ? { rate: seed.rate, date: seed.date } : null);
      this.apply({
        loading: false,
        error: seed.error ?? '',
        rate: seed.rate,
        date: seed.date,
      });
      return;
    }
    this.lastSeed = seed;

    const handled = this.lastHandled;
    if (
      handled &&
      handled.from === from &&
      handled.to === to &&
      handled.date === date
    ) {
      return;
    }
    this.lastHandled = { from, to, date };
    void this.fetch(from, to, date || undefined);
  }

  private async fetch(
    from: string,
    to: string,
    date?: string,
  ): Promise<void> {
    const seq = ++this.fetchSeq;
    /* The previous suggestion belongs to the old pair or date: drop it for
       the duration of the fetch so the line never quotes a stale rate
       against the new currencies. */
    this.suggestion.set(null);
    this.apply({
      loading: true,
      error: '',
      rate: this.state().rate,
      date: this.state().date,
    });

    try {
      const result = await this.exchangeRateService.getRate(from, to, date);
      if (seq !== this.fetchSeq || this.destroyed) return;
      this.suggestion.set({ rate: result.rate, date: result.date });
      this.apply({
        loading: false,
        error: '',
        rate: result.rate,
        date: result.date,
      });
    } catch (e: unknown) {
      if (seq !== this.fetchSeq || this.destroyed) return;
      const labels = this.labels();
      const msg =
        e instanceof OfflineError
          ? this.language.t(labels.errorOffline)
          : this.language.t(labels.errorFetch);
      this.suggestion.set(null);
      this.apply({ loading: false, error: msg, rate: null, date: '' });
    }
  }

  private apply(next: RateState): void {
    if (this.destroyed) return;
    this.state.set(next);
    this.stateChange.emit(next);
  }
}

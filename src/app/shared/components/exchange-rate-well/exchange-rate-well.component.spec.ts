import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ExchangeRateWellComponent,
  ExchangeRateWellLabels,
  RateState,
} from './exchange-rate-well.component';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { OfflineError } from '../../../core/models/offline-error';

const LABELS: ExchangeRateWellLabels = {
  heading: 'transactionForm.exchangeRate',
  fetching: 'transactionForm.fetchingRate',
  equivalent: 'transactionForm.equivalent',
  suggested: 'transactionForm.suggestedRate',
  rateAria: 'transactionForm.exchangeRateAria',
  equivalentAria: 'transactionForm.equivalentAria',
  errorOffline: 'transactionForm.error.offlineRate',
  errorFetch: 'transactionForm.error.rateFetch',
};

function makeRate(rate: number, date = '2026-08-26') {
  return { rate, from: 'USD', to: 'EUR', date };
}

function flush(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('ExchangeRateWellComponent', () => {
  let fixture: ComponentFixture<ExchangeRateWellComponent>;
  let component: ExchangeRateWellComponent;
  let exchangeRateService: { getRate: ReturnType<typeof vi.fn> };
  let emitted: RateState[];

  beforeEach(async () => {
    exchangeRateService = {
      getRate: vi.fn().mockResolvedValue(makeRate(1.08)),
    };

    await TestBed.configureTestingModule({
      imports: [ExchangeRateWellComponent],
      providers: [{ provide: ExchangeRateService, useValue: exchangeRateService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ExchangeRateWellComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.stateChange.subscribe((s) => emitted.push(s));
    fixture.componentRef.setInput('labels', LABELS);
  });

  function setInput(name: string, value: unknown): void {
    fixture.componentRef.setInput(name, value);
  }

  it('hides the well entirely for a same-currency pair and never fetches', async () => {
    setInput('from', 'EUR');
    setInput('to', 'EUR');
    setInput('date', '2026-08-20');
    fixture.detectChanges();
    await flush();

    expect(fixture.nativeElement.querySelector('.exchange-rate-section')).toBeNull();
    expect(exchangeRateService.getRate).not.toHaveBeenCalled();
  });

  it('hides the well while either currency is missing', async () => {
    setInput('from', '');
    setInput('to', 'EUR');
    fixture.detectChanges();
    await flush();

    expect(fixture.nativeElement.querySelector('.exchange-rate-section')).toBeNull();
    expect(exchangeRateService.getRate).not.toHaveBeenCalled();
  });

  it('fetches the rate for a cross-currency pair and shows the well', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('date', '2026-08-20');
    fixture.detectChanges();

    // While loading: the status line shows and the rate is still missing.
    expect(fixture.nativeElement.querySelector('.rate-status')?.textContent).toContain(
      'Fetching rate',
    );
    expect(emitted.at(-1)).toMatchObject({ loading: true, rate: null });

    await flush();
    fixture.detectChanges();

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-08-20');
    expect(fixture.nativeElement.querySelector('.rate-status')).toBeNull();
    const rateInput = fixture.nativeElement.querySelector(
      'input[name="rate"]',
    ) as HTMLInputElement;
    expect(rateInput.value).toBe('1.08');
    const source = fixture.nativeElement.querySelector('.rate-source');
    expect(source?.textContent).toContain('1 USD');
    expect(source?.textContent).toContain('1.08');
    expect(source?.textContent).toContain('EUR');
    expect(source?.textContent).toContain('2026-08-26');
    expect(exchangeRateService.getRate).toHaveBeenCalledTimes(1);
    expect(emitted.at(-1)).toMatchObject({
      loading: false,
      error: '',
      rate: 1.08,
      date: '2026-08-26',
    });
  });

  it('re-fetches when the date changes on the same pair', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('date', '2026-08-20');
    fixture.detectChanges();
    await flush();

    exchangeRateService.getRate.mockResolvedValueOnce(makeRate(1.12, '2026-01-15'));
    setInput('date', '2026-01-15');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(exchangeRateService.getRate).toHaveBeenLastCalledWith('USD', 'EUR', '2026-01-15');
    expect(component.state().rate).toBe(1.12);
  });

  it('re-fetches when the currency pair changes', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    fixture.detectChanges();
    await flush();

    exchangeRateService.getRate.mockResolvedValue({
      rate: 1.17,
      from: 'GBP',
      to: 'EUR',
      date: '2026-08-26',
    });
    setInput('from', 'GBP');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(exchangeRateService.getRate).toHaveBeenLastCalledWith('GBP', 'EUR', undefined);
    expect(component.state().rate).toBe(1.17);
  });

  it('resets and emits a missing rate when the pair becomes same-currency', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    fixture.detectChanges();
    await flush();
    expect(component.state().rate).toBe(1.08);

    setInput('from', 'EUR');
    fixture.detectChanges();
    await flush();

    expect(fixture.nativeElement.querySelector('.exchange-rate-section')).toBeNull();
    expect(component.state()).toMatchObject({ loading: false, error: '', rate: null, date: '' });
    expect(emitted.at(-1)).toMatchObject({ loading: false, rate: null });
  });

  it('surfaces the offline error copy and emits a missing rate', async () => {
    exchangeRateService.getRate.mockRejectedValue(new OfflineError());
    setInput('from', 'USD');
    setInput('to', 'EUR');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rate-error')?.textContent).toContain(
      'You are offline. Enter the exchange rate manually.',
    );
    expect(emitted.at(-1)).toMatchObject({
      loading: false,
      error: 'You are offline. Enter the exchange rate manually.',
      rate: null,
    });
  });

  it('surfaces the generic failure copy for non-offline errors', async () => {
    exchangeRateService.getRate.mockRejectedValue(new Error('boom'));
    setInput('from', 'USD');
    setInput('to', 'EUR');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.rate-error')?.textContent).toContain(
      'Could not fetch the rate. Enter it manually.',
    );
  });

  it('emits manual overrides through stateChange', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    fixture.detectChanges();
    await flush();

    component.onRateInput(1.2);
    fixture.detectChanges();

    expect(component.state().rate).toBe(1.2);
    expect(emitted.at(-1)).toMatchObject({ rate: 1.2 });
  });

  it('keeps the Suggested Rate line and its date when a rate is typed manually', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('date', '2026-08-20');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    component.onRateInput(1.2);
    fixture.detectChanges();

    expect(component.state().rate).toBe(1.2);
    const source = fixture.nativeElement.querySelector('.rate-source');
    expect(source?.textContent).toContain('1.08');
    expect(source?.textContent).toContain('2026-08-26');
    expect(source?.textContent).not.toContain('1.2');
  });

  it('replaces the Suggested Rate only on a refetch, not on manual input', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('date', '2026-08-20');
    fixture.detectChanges();
    await flush();

    component.onRateInput(1.2);
    fixture.detectChanges();

    exchangeRateService.getRate.mockResolvedValueOnce(makeRate(1.14, '2026-02-01'));
    setInput('date', '2026-02-01');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const source = fixture.nativeElement.querySelector('.rate-source');
    expect(source?.textContent).toContain('1.14');
    expect(source?.textContent).toContain('2026-02-01');
    expect(component.state().rate).toBe(1.14);
  });

  it('shows one Exchange Rate heading and no visible pair label on the rate input', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    fixture.detectChanges();
    await flush();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('.exchange-rate-section');
    const headings = section.querySelectorAll('h4');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent).toContain('Exchange Rate');
    expect(section.textContent).not.toContain('Exchange Rate (USD → EUR)');
    const rateInput = fixture.nativeElement.querySelector(
      'input[name="rate"]',
    ) as HTMLInputElement;
    expect(rateInput.getAttribute('aria-label')).toBe('Exchange rate');
  });

  it('adopts a seed without fetching (stored or restored rate)', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('date', '2026-08-20');
    setInput('seed', { rate: 1.1, date: 'stored' });
    fixture.detectChanges();
    await flush();

    expect(exchangeRateService.getRate).not.toHaveBeenCalled();
    expect(component.state()).toMatchObject({ loading: false, error: '', rate: 1.1, date: 'stored' });
    expect(emitted.at(-1)).toMatchObject({ rate: 1.1, date: 'stored' });
    const rateInput = fixture.nativeElement.querySelector(
      'input[name="rate"]',
    ) as HTMLInputElement;
    expect(rateInput.value).toBe('1.1');
  });

  it('re-fetches after a seeded rate once the date changes', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('date', '2026-08-20');
    setInput('seed', { rate: 1.1, date: 'stored' });
    fixture.detectChanges();
    await flush();

    setInput('date', '2026-01-15');
    fixture.detectChanges();
    await flush();

    expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-15');
    expect(component.state().rate).toBe(1.08);
  });

  it('restores an error state from a seed (draft restore)', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('seed', { rate: null, date: '', error: 'You are offline.' });
    fixture.detectChanges();
    await flush();

    expect(exchangeRateService.getRate).not.toHaveBeenCalled();
    expect(component.state()).toMatchObject({ loading: false, error: 'You are offline.', rate: null });
    expect(fixture.nativeElement.querySelector('.rate-error')?.textContent).toContain(
      'You are offline.',
    );
  });

  it('renders the equivalent readonly field', async () => {
    setInput('from', 'USD');
    setInput('to', 'EUR');
    setInput('equivalent', 108);
    fixture.detectChanges();
    await flush();

    const equiv = fixture.nativeElement.querySelector(
      'input[name="equiv"]',
    ) as HTMLInputElement;
    expect(equiv.readOnly).toBe(true);
    expect(equiv.value).toBe('108');
    expect(fixture.nativeElement.querySelector('.exchange-rate-section')?.textContent).toContain(
      'EUR Equivalent',
    );
  });
});

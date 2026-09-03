import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransferFormComponent, TransferDraft } from './transfer-form.component';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { TransferService } from '../../../core/services/transfer.service';
import { LanguageService } from '../../../core/services/language.service';
import { db } from '../../../core/db/database';
import { Account } from '../../../core/models/account.model';
import { Transfer } from '../../../core/models/transfer.model';
import { getCurrentPeriod, getCurrentYear } from '../../../core/types/period.type';

function flush(ms = 10): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('TransferFormComponent', () => {
  let fixture: ComponentFixture<TransferFormComponent>;
  let component: TransferFormComponent;
  let transferService: TransferService;
  let exchangeRateService: { getRate: ReturnType<typeof vi.fn> };
  let eurAccountId: number;
  let eur2AccountId: number;
  let usdAccountId: number;

  beforeEach(async () => {
    await db.delete();
    await db.open();

    exchangeRateService = {
      getRate: vi
        .fn()
        .mockResolvedValue({ rate: 1.08, from: 'USD', to: 'EUR', date: '2026-08-26' }),
    };

    await TestBed.configureTestingModule({
      imports: [TransferFormComponent],
      providers: [{ provide: ExchangeRateService, useValue: exchangeRateService }],
    }).compileComponents();

    transferService = TestBed.inject(TransferService);

    const eur = await db.accounts.add({
      name: 'Cash',
      currency: 'EUR',
      initialBalance: 100000,
      active: true,
      createdAt: new Date(),
    });
    eurAccountId = eur;
    const eur2 = await db.accounts.add({
      name: 'Card',
      currency: 'EUR',
      initialBalance: 50000,
      active: true,
      createdAt: new Date(),
    });
    eur2AccountId = eur2;
    const usd = await db.accounts.add({
      name: 'Dollars',
      currency: 'USD',
      initialBalance: 1000,
      active: true,
      createdAt: new Date(),
    });
    usdAccountId = usd;

    fixture = TestBed.createComponent(TransferFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('accounts', await db.accounts.toArray());
  });

  afterEach(async () => {
    fixture.destroy();
    // The LanguageService is a worker-wide singleton: reset it so a Spanish
    // assertion here never leaks into later spec files.
    await TestBed.inject(LanguageService).setLanguage('en');
    await db.delete();
    vi.restoreAllMocks();
  });

  function rateSection(): Element | null {
    return fixture.nativeElement.querySelector('.exchange-rate-section');
  }

  describe('fields and defaults', () => {
    it('renders the full form with a New Transfer heading', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      const el = fixture.nativeElement;
      expect(el.querySelector('h3').textContent).toContain('New Transfer');
      expect(el.querySelector('input[type="number"]')).toBeTruthy();
      expect(el.querySelector('input[type="date"]')).toBeTruthy();
      expect(el.querySelector('input[type="text"]')).toBeTruthy();
      expect(el.querySelectorAll('select').length).toBe(4);
    });

    it('defaults the route to the first two accounts and today as period', async () => {
      await component.ngOnInit();

      const f = component.form();
      expect(f.sourceAccountId).toBe(eurAccountId);
      expect(f.destAccountId).toBe(eur2AccountId);
      expect(f.date).toBe(new Date().toISOString().split('T')[0]);
      expect(f.period).toBe(getCurrentPeriod());
      expect(f.year).toBe(getCurrentYear());
      expect(f.sourceAmount).toBe(0);
    });

    it('excludes the source account from the destination options', async () => {
      await component.ngOnInit();
      component.onSourceChange(usdAccountId);

      const filtered = component.filteredDestinationAccounts();
      expect(filtered.find((a) => a.id === usdAccountId)).toBeUndefined();
      expect(filtered.length).toBe(2);
    });

    it('shows every account as a destination while no source is chosen', async () => {
      await component.ngOnInit();
      component.onSourceChange(0);

      expect(component.filteredDestinationAccounts().length).toBe(3);
    });

    it('resets the destination when the source changes to match it', async () => {
      await component.ngOnInit();
      component.onSourceChange(usdAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eurAccountId }));

      component.onSourceChange(eurAccountId);

      expect(component.form().sourceAccountId).toBe(eurAccountId);
      expect(component.form().destAccountId).not.toBe(eurAccountId);
    });

    it('keeps the destination when the source changes to a different account', async () => {
      await component.ngOnInit();
      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eur2AccountId }));

      component.onSourceChange(usdAccountId);

      expect(component.form().destAccountId).toBe(eur2AccountId);
    });

    it('re-derives the period and year when the date changes', async () => {
      await component.ngOnInit();

      component.onDateChange('2025-12-22');
      expect(component.form().period).toBe(12);
      expect(component.form().year).toBe(2025);

      component.onDateChange('2026-03-10');
      expect(component.form().period).toBe(3);
      expect(component.form().year).toBe(2026);
    });

    it('keeps a manually overridden period and year after the date derivation', async () => {
      await component.ngOnInit();

      component.onDateChange('2026-03-10');
      component.form.update((f) => ({ ...f, period: 1, year: 2024 }));

      expect(component.form().period).toBe(1);
      expect(component.form().year).toBe(2024);
    });
  });

  describe('exchange rate', () => {
    it('fetches the rate for a cross-currency pair and computes the destination amount', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(usdAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eurAccountId }));
      component.onDateChange('2026-08-20');
      fixture.detectChanges();
      await flush();

      expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-08-20');
      expect(component.form().exchangeRate).toBe(1.08);

      component.onSourceAmountChange(250);
      expect(component.form().destinationAmount).toBe(270);
    });

    it('re-fetches the rate when the transfer date changes', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(usdAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eurAccountId }));
      component.onDateChange('2026-08-20');
      fixture.detectChanges();
      await flush();
      expect(component.form().exchangeRate).toBe(1.08);

      exchangeRateService.getRate.mockResolvedValueOnce({
        rate: 1.12,
        from: 'USD',
        to: 'EUR',
        date: '2026-01-15',
      });

      component.onDateChange('2026-01-15');
      fixture.detectChanges();
      await flush();

      expect(exchangeRateService.getRate).toHaveBeenCalledWith('USD', 'EUR', '2026-01-15');
      expect(component.form().exchangeRate).toBe(1.12);
    });

    it('fetches no rate when source and destination share a currency', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(eur2AccountId);
      fixture.detectChanges();
      await flush();

      expect(exchangeRateService.getRate).not.toHaveBeenCalled();
      expect(component.form().exchangeRate).toBe(1);
      expect(rateSection()).toBeNull();
    });

    it('recomputes the destination amount from a manually overridden rate', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(usdAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eurAccountId }));
      component.onDateChange('2026-08-20');
      fixture.detectChanges();
      await flush();

      component.form.update((f) => ({ ...f, exchangeRate: 1.15 }));
      component.onSourceAmountChange(200);

      expect(component.form().destinationAmount).toBe(230);
    });

    it('shows the suggested rate text for a cross-currency pair', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(usdAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eurAccountId }));
      component.onDateChange('2026-08-20');
      fixture.detectChanges();
      await flush();
      fixture.detectChanges();

      const rateText = fixture.nativeElement.querySelector('.rate-source');
      expect(rateText).toBeTruthy();
      expect(rateText.textContent).toContain('1 USD');
      expect(rateText.textContent).toContain('1.08');
      expect(rateText.textContent).toContain('EUR');
    });

    it('gates the save on the rate fetch and states why', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(usdAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eurAccountId, sourceAmount: 100 }));
      component.rateState.set({ loading: true, error: '', rate: null, date: '' });

      expect(component.canSubmit()).toBe(false);
      expect(component.disabledReason()).toBe('The exchange rate is still loading.');
    });
  });

  describe('editing', () => {
    it('opens prefilled when an existing transfer is set for edit', async () => {
      const t = await transferService.create(
        eurAccountId,
        eur2AccountId,
        500,
        new Date('2025-12-22'),
        1,
        'savings',
        1,
        2026,
      );
      fixture.componentRef.setInput('editTransfer', t);
      await flush();
      fixture.detectChanges();

      expect(component.editingId()).toBe(t.id);
      expect(component.form().sourceAccountId).toBe(eurAccountId);
      expect(component.form().destAccountId).toBe(eur2AccountId);
      expect(component.form().sourceAmount).toBe(500);
      expect(component.form().note).toBe('savings');
      expect(component.form().year).toBe(2026);
      expect(fixture.nativeElement.querySelector('h3').textContent).toContain('Edit Transfer');
    });

    it('seeds the well with the stored rate for a cross-currency edit without fetching', async () => {
      const t = await transferService.create(
        usdAccountId,
        eurAccountId,
        100,
        new Date('2025-12-22'),
        1,
        'abroad',
        1.05,
      );
      fixture.componentRef.setInput('editTransfer', t);
      await flush();
      fixture.detectChanges();

      expect(component.form().exchangeRate).toBe(1.05);
      await flush();
      expect(exchangeRateService.getRate).not.toHaveBeenCalled();
      expect(rateSection()).toBeTruthy();
    });

    it('shows no exchange-rate section for a same-currency edit', async () => {
      const t = await transferService.create(
        eurAccountId,
        eur2AccountId,
        500,
        new Date('2025-12-22'),
        1,
        'savings',
      );
      fixture.componentRef.setInput('editTransfer', t);
      await flush();
      fixture.detectChanges();

      expect(rateSection()).toBeNull();
    });
  });

  describe('saving', () => {
    it('creates a transfer end to end and emits saved', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eur2AccountId, sourceAmount: 300, note: 'rent' }));

      let savedCount = 0;
      let savedWasEdit: boolean | undefined;
      component.saved.subscribe((wasEdit) => {
        savedCount++;
        savedWasEdit = wasEdit;
      });
      await component.onSubmit();

      const transfers = await transferService.getAll();
      expect(transfers).toHaveLength(1);
      expect(transfers[0].sourceAccountId).toBe(eurAccountId);
      expect(transfers[0].destinationAccountId).toBe(eur2AccountId);
      expect(transfers[0].sourceAmount).toBe(300);
      expect(transfers[0].note).toBe('rent');
      expect(savedCount).toBe(1);
      expect(savedWasEdit).toBe(false);
      expect(component.saving()).toBe(false);
    });

    it('stores the fetched rate and the converted destination amount for a cross-currency transfer', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(usdAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eurAccountId, sourceAmount: 100 }));
      component.onDateChange('2026-08-20');
      fixture.detectChanges();
      await flush();

      await component.onSubmit();

      const transfers = await transferService.getAll();
      expect(transfers).toHaveLength(1);
      expect(transfers[0].exchangeRate).toBe(1.08);
      expect(transfers[0].destinationAmount).toBe(108);
    });

    it('saves the form period and year, not the date-derived ones', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({
        ...f,
        destAccountId: eur2AccountId,
        sourceAmount: 500,
        date: '2025-12-22',
        period: 1,
        year: 2026,
      }));

      await component.onSubmit();

      const transfers = await transferService.getAll();
      expect(transfers[0].year).toBe(2026);
      expect(transfers[0].date.getFullYear()).toBe(2025);
    });

    it('updates the edited transfer and emits saved', async () => {
      const t = await transferService.create(
        eurAccountId,
        eur2AccountId,
        500,
        new Date('2025-12-22'),
        1,
        'savings',
      );
      fixture.componentRef.setInput('editTransfer', t);
      await flush();
      fixture.detectChanges();

      component.form.update((f) => ({ ...f, sourceAmount: 750 }));

      let savedWasEdit: boolean | undefined;
      component.saved.subscribe((wasEdit) => (savedWasEdit = wasEdit));
      await component.onSubmit();

      const transfers = await transferService.getAll();
      expect(transfers).toHaveLength(1);
      expect(transfers[0].sourceAmount).toBe(750);
      expect(transfers[0].destinationAmount).toBe(750);
      expect(savedWasEdit).toBe(true);
    });

    it('keeps the form open with its values when the save fails', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({ ...f, destAccountId: 9999, sourceAmount: 10 }));

      let saved = 0;
      component.saved.subscribe(() => saved++);
      await component.onSubmit();

      expect(saved).toBe(0);
      expect(component.saving()).toBe(false);
      expect(component.errorMessage()).toContain('no longer exists');
      expect(component.form().sourceAmount).toBe(10);
      expect(component.form().destAccountId).toBe(9999);
    });    it('states the failure in the active Language', async () => {
      await TestBed.inject(LanguageService).setLanguage('es');
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({ ...f, destAccountId: 9999, sourceAmount: 10 }));

      await component.onSubmit();

      expect(component.errorMessage()).toBe(
        'La cuenta de destino ya no existe. Elige otra e inténtalo de nuevo.',
      );
    });

    it('explains why the save button is disabled while the form is incomplete', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      // Changing the source to the current destination zeroes the
      // destination, leaving the route incomplete.
      component.onSourceChange(eur2AccountId);
      expect(component.disabledReason()).toBe('Choose two accounts.');

      component.form.update((f) => ({ ...f, destAccountId: eur2AccountId }));
      expect(component.disabledReason()).toBe('Choose two different accounts.');

      component.form.update((f) => ({ ...f, destAccountId: eurAccountId }));
      expect(component.disabledReason()).toBe('Enter an amount greater than zero.');

      component.form.update((f) => ({ ...f, sourceAmount: 100 }));
      expect(component.disabledReason()).toBe('');
    });

    it('stays quiet about the disabled save while a save is in flight', async () => {
      await component.ngOnInit();
      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eur2AccountId, sourceAmount: 0 }));
      component.saving.set(true);

      expect(component.disabledReason()).toBe('');
    });

    it('blocks submit while a save is in flight and unblocks after failure', async () => {
      await component.ngOnInit();
      fixture.detectChanges();
      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({ ...f, destAccountId: eur2AccountId, sourceAmount: 25 }));

      component.saving.set(true);
      expect(component.canSubmit()).toBe(false);

      component.saving.set(false);
      component.form.update((f) => ({ ...f, destAccountId: 9999 }));
      await component.onSubmit();

      expect(component.saving()).toBe(false);
      expect(component.canSubmit()).toBe(true);
      expect(component.errorMessage()).toBeTruthy();
    });
  });

  describe('draft capture and restore', () => {
    it('captures the form, edit context, and rate state as a draft', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      component.onSourceChange(eurAccountId);
      component.form.update((f) => ({ ...f, sourceAmount: 90, note: 'bus pass' }));
      component.rateState.set({ loading: false, error: '', rate: 1.08, date: '2026-08-26' });

      const draft = component.draft();
      expect(draft.editingId).toBeNull();
      expect(draft.form.sourceAccountId).toBe(eurAccountId);
      expect(draft.form.sourceAmount).toBe(90);
      expect(draft.form.note).toBe('bus pass');
      expect(draft.rateState.rate).toBe(1.08);
    });

    it('restores a draft instead of the defaults when initialDraft is provided', async () => {
      const draft: TransferDraft = {
        form: {
          sourceAccountId: eur2AccountId,
          destAccountId: eurAccountId,
          sourceAmount: 90,
          destinationAmount: 90,
          exchangeRate: 1,
          date: '2026-08-01',
          period: 8,
          year: 2026,
          note: 'bus pass',
        },
        editingId: null,
        rateState: { loading: false, error: '', rate: null, date: '' },
      };
      fixture.componentRef.setInput('initialDraft', draft);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(component.editingId()).toBeNull();
      expect(component.form().sourceAccountId).toBe(eur2AccountId);
      expect(component.form().sourceAmount).toBe(90);
      expect(component.form().note).toBe('bus pass');
    });

    it('restores an edit draft so the save keeps the id', async () => {
      const t = await transferService.create(
        eurAccountId,
        eur2AccountId,
        500,
        new Date('2025-12-22'),
        1,
        'savings',
      );
      const draft: TransferDraft = {
        form: {
          sourceAccountId: eurAccountId,
          destAccountId: eur2AccountId,
          sourceAmount: 750,
          destinationAmount: 750,
          exchangeRate: 1,
          date: '2025-12-22',
          period: 1,
          year: 2026,
          note: 'savings',
        },
        editingId: t.id!,
        rateState: { loading: false, error: '', rate: 1, date: 'stored' },
      };
      fixture.componentRef.setInput('initialDraft', draft);

      await component.ngOnInit();
      fixture.detectChanges();

      expect(component.editingId()).toBe(t.id);
      expect(component.form().sourceAmount).toBe(750);

      await component.onSubmit();

      const transfers = await transferService.getAll();
      expect(transfers[0].sourceAmount).toBe(750);
    });

    it('emits close when the user cancels', async () => {
      await component.ngOnInit();
      let closed = false;
      component.close.subscribe(() => (closed = true));

      component.cancel();

      expect(closed).toBe(true);
    });
  });

  describe('arrival focus', () => {
    it('focuses the form heading on arrival', async () => {
      await component.ngOnInit();
      fixture.detectChanges();

      const heading = fixture.nativeElement.querySelector('h3');
      expect(document.activeElement).toBe(heading);
    });
  });
});

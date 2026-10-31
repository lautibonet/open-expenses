import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ScopeControlComponent } from './scope-control.component';
import { Scope } from '../../../core/scope/scope';
import { MonthNumber } from '../../../core/types/period.type';

const scope = (fy: number, fm: MonthNumber, ty: number, tm: MonthNumber): Scope => ({
  from: { year: fy, month: fm },
  to: { year: ty, month: tm },
});
const movement = (year: number, period: MonthNumber) => ({
  period,
  year,
  date: new Date(year, period - 1, 10),
});

/* Movements whose latest Period is January 2026, so every preset anchors there. */
const movements = [movement(2025, 6), movement(2025, 11), movement(2026, 1)];

describe('ScopeControlComponent', () => {
  let fixture: ComponentFixture<ScopeControlComponent>;
  let component: ScopeControlComponent;
  let emitted: Scope[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ScopeControlComponent] }).compileComponents();
    fixture = TestBed.createComponent(ScopeControlComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.scopeChange.subscribe(next => {
      emitted.push(next);
      fixture.componentRef.setInput('scope', next);
    });
    fixture.componentRef.setInput('movements', movements);
  });

  /* NgModel writes a select's value a tick after change detection. */
  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(current: Scope): Promise<void> {
    fixture.componentRef.setInput('scope', current);
    await settle();
  }

  function select(label: string): HTMLSelectElement | null {
    return fixture.nativeElement.querySelector(`select[aria-label="${label}"]`);
  }

  async function choose(label: string, text: string): Promise<void> {
    const element = select(label)!;
    const index = Array.from(element.options).findIndex(o => o.textContent?.trim() === text);
    expect(index, `${label} offers ${text}`).toBeGreaterThanOrEqual(0);
    element.selectedIndex = index;
    element.dispatchEvent(new Event('change'));
    await settle();
  }

  function summary(): string | null {
    return fixture.nativeElement.querySelector('.scope-summary')?.textContent.trim() ?? null;
  }

  function shownPreset(): string {
    const element = select('Scope preset')!;
    return element.options[element.selectedIndex].textContent!.trim();
  }

  it('offers the presets in order, then Custom', async () => {
    await render(scope(2026, 1, 2026, 1));

    const labels = Array.from(select('Scope preset')!.options).map(o => o.textContent?.trim());
    expect(labels).toEqual([
      'Last period', 'Last 3', 'Last 6', 'Last 12', 'Year to date', 'Whole year', 'Custom',
    ]);
  });

  it('hides the From and To pickers on a one-Period Scope that a preset names', async () => {
    await render(scope(2026, 1, 2026, 1));

    expect(shownPreset()).toBe('Last period');
    expect(select('From month')).toBeNull();
    expect(select('To month')).toBeNull();
  });

  it('shows the Scope a preset names as text beside the select, without pickers', async () => {
    await render(scope(2025, 11, 2026, 1));

    expect(shownPreset()).toBe('Last 3');
    expect(select('From month')).toBeNull();
    expect(summary()).toBe('November 2025 – January 2026');
  });

  it('shows the From and To pickers for a Scope no preset names', async () => {
    await render(scope(2024, 11, 2025, 1));

    expect(shownPreset()).toBe('Custom');
    expect(summary()).toBeNull();
    expect(select('From month')!.options[select('From month')!.selectedIndex].textContent?.trim()).toBe('November');
    expect(select('From year')!.options[select('From year')!.selectedIndex].textContent?.trim()).toBe('2024');
    expect(select('To month')!.options[select('To month')!.selectedIndex].textContent?.trim()).toBe('January');
    expect(select('To year')!.options[select('To year')!.selectedIndex].textContent?.trim()).toBe('2025');
  });

  it('names the preset the screen opens on when several produce the same Scope', async () => {
    fixture.componentRef.setInput('defaultPreset', 'yearToDate');
    await render(scope(2026, 1, 2026, 1));

    expect(shownPreset()).toBe('Year to date');
  });

  it('fills in the From and To a preset produces', async () => {
    await render(scope(2026, 1, 2026, 1));

    await choose('Scope preset', 'Last 3');
    expect(emitted.at(-1)).toEqual(scope(2025, 11, 2026, 1));

    await choose('Scope preset', 'Whole year');
    expect(emitted.at(-1)).toEqual(scope(2026, 1, 2026, 12));
    expect(shownPreset()).toBe('Whole year');
  });

  it('opens the pickers on Custom without moving the Scope', async () => {
    await render(scope(2026, 1, 2026, 1));

    await choose('Scope preset', 'Custom');

    expect(emitted).toEqual([]);
    expect(shownPreset()).toBe('Custom');
    expect(select('From month')).not.toBeNull();
    expect(select('To year')).not.toBeNull();
  });

  it('keeps the pickers open on Custom after narrowing back to one Period', async () => {
    await render(scope(2026, 1, 2026, 1));
    await choose('Scope preset', 'Custom');

    await choose('From year', '2025');
    expect(emitted.at(-1)).toEqual(scope(2025, 1, 2026, 1));
    await choose('From year', '2026');

    expect(emitted.at(-1)).toEqual(scope(2026, 1, 2026, 1));
    expect(select('From month')).not.toBeNull();
  });

  it('names the matching preset after an edit, and Custom when none matches', async () => {
    await render(scope(2025, 11, 2026, 1));
    await choose('Scope preset', 'Custom');

    await choose('From month', 'August');
    expect(emitted.at(-1)).toEqual(scope(2025, 8, 2026, 1));
    expect(shownPreset()).toBe('Last 6');

    await choose('From month', 'September');
    expect(shownPreset()).toBe('Custom');
  });

  it('names Year to date over a rolling preset when an edit matches both', async () => {
    fixture.componentRef.setInput('movements', [movement(2026, 1), movement(2026, 3)]);
    await render(scope(2026, 2, 2026, 3));

    await choose('From month', 'January');

    expect(emitted.at(-1)).toEqual(scope(2026, 1, 2026, 3));
    expect(shownPreset()).toBe('Year to date');
  });

  it('names Whole year over Year to date when an edit matches both', async () => {
    fixture.componentRef.setInput('movements', [movement(2025, 12)]);
    await render(scope(2025, 2, 2025, 12));

    await choose('From month', 'January');

    expect(shownPreset()).toBe('Whole year');
  });

  it('keeps the preset the user picked when it matches the Scope', async () => {
    fixture.componentRef.setInput('movements', [movement(2026, 1), movement(2026, 3)]);
    fixture.componentRef.setInput('defaultPreset', 'yearToDate');
    await render(scope(2026, 1, 2026, 3));

    await choose('Scope preset', 'Last 3');

    expect(shownPreset()).toBe('Last 3');
  });

  it('shows the default preset again when the screen applies a new Scope', async () => {
    await render(scope(2026, 1, 2026, 1));
    await choose('Scope preset', 'Last 6');

    await render(scope(2026, 1, 2026, 1));

    expect(shownPreset()).toBe('Last period');
    expect(select('From month')).toBeNull();
  });

  it('closes Custom when the screen applies a new one-Period Scope', async () => {
    fixture.componentRef.setInput('defaultPreset', 'yearToDate');
    await render(scope(2026, 1, 2026, 1));
    await choose('Scope preset', 'Custom');

    await render(scope(2026, 1, 2026, 1));

    expect(shownPreset()).toBe('Year to date');
    expect(select('From month')).toBeNull();
  });

  it('keeps the month when a year changes', async () => {
    await render(scope(2024, 11, 2025, 1));

    await choose('To year', '2026');

    expect(emitted.at(-1)).toEqual(scope(2024, 11, 2026, 1));
  });

  it('moves the To Period to match a From picked after it', async () => {
    await render(scope(2025, 11, 2026, 1));
    await choose('Scope preset', 'Custom');

    await choose('From year', '2026');

    expect(emitted.at(-1)).toEqual(scope(2026, 11, 2026, 11));
  });

  it('moves the From Period to match a To picked before it', async () => {
    await render(scope(2025, 11, 2026, 1));
    await choose('Scope preset', 'Custom');

    await choose('To year', '2025');
    expect(emitted.at(-1)).toEqual(scope(2025, 1, 2025, 1));
  });

  it('offers every month and every year from the earliest with data through both ends', async () => {
    await render(scope(2025, 11, 2027, 1));

    expect(select('From month')!.options).toHaveLength(12);
    const years = Array.from(select('To year')!.options).map(o => Number(o.textContent));
    expect(years[0]).toBe(2025);
    expect(years).toContain(2027);
  });
});

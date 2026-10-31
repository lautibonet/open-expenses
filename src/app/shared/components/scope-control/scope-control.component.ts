import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../../core/services/language.service';
import { MonthNumber, ScopeAwareMovement } from '../../../core/types/period.type';
import {
  SCOPE_PRESETS,
  Scope,
  ScopePreset,
  ScopePresetChoice,
  changeFrom,
  changeTo,
  isMultiPeriod,
  matchingPreset,
  presetScope,
  scopeOptions,
} from '../../../core/scope/scope';

/* The Scope control shared by Movements and Stats (ADR 0029): a preset
   select, and the From and To pickers whenever the Scope covers more than
   one Period or Custom is chosen. The screen owns the Scope; the control
   only proposes the next one. */
@Component({
  selector: 'app-scope-control',
  imports: [FormsModule],
  templateUrl: './scope-control.component.html',
  styleUrl: './scope-control.component.scss',
})
export class ScopeControlComponent {
  language = inject(LanguageService);

  scope = input.required<Scope>();
  /* Every recorded movement: the presets anchor on the latest Period with
     movements, and the year pickers start at the earliest. */
  movements = input<ScopeAwareMovement[]>([]);
  /* The preset the screen opens on, named when several produce its Scope. */
  defaultPreset = input<ScopePreset>('thisPeriod');
  scopeChange = output<Scope>();

  readonly presets = SCOPE_PRESETS;

  /* The preset last picked from the select; null once an end is edited, so
     the select names whichever preset the edited Scope matches. */
  private chosen = signal<ScopePresetChoice | null>(null);
  /* Custom keeps the pickers open, even on a one-Period Scope. */
  private customOpen = signal(false);

  private options = computed(() => scopeOptions(this.movements(), this.scope()));
  years = computed(() => this.options().years);
  months = computed(() => this.options().months);

  shownPreset = computed<ScopePresetChoice>(() => {
    const chosen = this.chosen();
    if (chosen === 'custom') return 'custom';
    return matchingPreset(this.scope(), this.movements(), chosen ?? this.defaultPreset());
  });

  pickersShown = computed(
    () => this.customOpen() || isMultiPeriod(this.scope()) || this.shownPreset() === 'custom',
  );

  onPresetChange(choice: ScopePresetChoice): void {
    this.chosen.set(choice);
    if (choice === 'custom') {
      this.customOpen.set(true);
      return;
    }
    this.customOpen.set(false);
    this.scopeChange.emit(presetScope(choice, this.scope(), this.movements()));
  }

  onFromMonthChange(month: MonthNumber): void {
    this.editFrom({ year: this.scope().from.year, month });
  }

  onFromYearChange(year: number): void {
    this.editFrom({ year, month: this.scope().from.month });
  }

  onToMonthChange(month: MonthNumber): void {
    this.editTo({ year: this.scope().to.year, month });
  }

  onToYearChange(year: number): void {
    this.editTo({ year, month: this.scope().to.month });
  }

  private editFrom(from: Scope['from']): void {
    this.chosen.set(null);
    this.scopeChange.emit(changeFrom(this.scope(), from));
  }

  private editTo(to: Scope['to']): void {
    this.chosen.set(null);
    this.scopeChange.emit(changeTo(this.scope(), to));
  }
}

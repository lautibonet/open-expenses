import { Component, inject, input, output } from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';
import { DeleteFlow, DeleteTarget } from '../delete-flow';
import { DELETE_COPY } from './delete-copy';

/* Issue #203: the ADR 0018 refusal under a Settings row — why Delete was
   refused, with Deactivation offered as the fallback for an active item. */
@Component({
  selector: 'app-delete-refusal',
  templateUrl: './delete-refusal.component.html',
  styleUrl: './delete-refusal.component.scss',
})
export class DeleteRefusalComponent {
  language = inject(LanguageService);

  flow = input.required<DeleteFlow>();
  target = input.required<DeleteTarget>();
  active = input.required<boolean>();
  deactivate = output<void>();

  message(): string {
    return DELETE_COPY[this.target().kind].refusal;
  }
}

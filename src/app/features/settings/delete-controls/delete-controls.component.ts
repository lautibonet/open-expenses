import { Component, inject, input, output } from '@angular/core';
import { LanguageService } from '../../../core/services/language.service';
import { DeleteFlow, DeleteTarget } from '../delete-flow';
import { DELETE_COPY, DeleteCopy } from './delete-copy';

/* Issue #203: a Settings row's trash button, which turns into the
   confirm/cancel pair while the row's Delete flow (ADR 0018) is confirming.
   The row decides what requesting and confirming do; cancel needs no row. */
@Component({
  selector: 'app-delete-controls',
  templateUrl: './delete-controls.component.html',
  styleUrl: './delete-controls.component.scss',
})
export class DeleteControlsComponent {
  language = inject(LanguageService);

  flow = input.required<DeleteFlow>();
  target = input.required<DeleteTarget>();
  requested = output<void>();
  confirmed = output<void>();

  copy(): DeleteCopy {
    return DELETE_COPY[this.target().kind];
  }
}

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CaptureFormService {
  private readonly quickAddRequests = signal(0);
  private readonly transferRequests = signal(0);

  readonly pendingQuickAddRequests = this.quickAddRequests.asReadonly();
  readonly pendingTransferRequests = this.transferRequests.asReadonly();

  requestQuickAdd(): void {
    this.quickAddRequests.update((n) => n + 1);
  }

  requestTransfer(): void {
    this.transferRequests.update((n) => n + 1);
  }

  consumeQuickAddRequests(): void {
    this.quickAddRequests.set(0);
  }

  consumeTransferRequests(): void {
    this.transferRequests.set(0);
  }
}

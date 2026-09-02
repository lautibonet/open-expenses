import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CaptureFormService {
  private readonly transactionFormRequests = signal(0);
  private readonly transferRequests = signal(0);

  readonly pendingTransactionFormRequests = this.transactionFormRequests.asReadonly();
  readonly pendingTransferRequests = this.transferRequests.asReadonly();

  requestTransactionForm(): void {
    this.transactionFormRequests.update((n) => n + 1);
  }

  requestTransfer(): void {
    this.transferRequests.update((n) => n + 1);
  }

  consumeTransactionFormRequests(): void {
    this.transactionFormRequests.set(0);
  }

  consumeTransferRequests(): void {
    this.transferRequests.set(0);
  }
}

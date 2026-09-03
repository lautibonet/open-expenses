import { TestBed } from '@angular/core/testing';
import { CaptureFormService } from './capture-form.service';

describe('CaptureFormService', () => {
  let service: CaptureFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CaptureFormService);
  });

  it('starts with no pending requests', () => {
    expect(service.pendingTransactionFormRequests()).toBe(0);
    expect(service.pendingTransferRequests()).toBe(0);
  });

  it('counts each request per capture form', () => {
    service.requestTransactionForm();
    service.requestTransactionForm();
    service.requestTransfer();
    expect(service.pendingTransactionFormRequests()).toBe(2);
    expect(service.pendingTransferRequests()).toBe(1);
  });

  it('consumes pending requests so they do not re-fire later', () => {
    service.requestTransactionForm();
    service.requestTransfer();
    service.consumeTransactionFormRequests();
    service.consumeTransferRequests();
    expect(service.pendingTransactionFormRequests()).toBe(0);
    expect(service.pendingTransferRequests()).toBe(0);
  });
});

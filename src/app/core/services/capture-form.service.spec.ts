import { TestBed } from '@angular/core/testing';
import { CaptureFormService } from './capture-form.service';

describe('CaptureFormService', () => {
  let service: CaptureFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CaptureFormService);
  });

  it('starts with no pending requests', () => {
    expect(service.pendingQuickAddRequests()).toBe(0);
    expect(service.pendingTransferRequests()).toBe(0);
  });

  it('counts each request per capture form', () => {
    service.requestQuickAdd();
    service.requestQuickAdd();
    service.requestTransfer();
    expect(service.pendingQuickAddRequests()).toBe(2);
    expect(service.pendingTransferRequests()).toBe(1);
  });

  it('consumes pending requests so they do not re-fire later', () => {
    service.requestQuickAdd();
    service.requestTransfer();
    service.consumeQuickAddRequests();
    service.consumeTransferRequests();
    expect(service.pendingQuickAddRequests()).toBe(0);
    expect(service.pendingTransferRequests()).toBe(0);
  });
});

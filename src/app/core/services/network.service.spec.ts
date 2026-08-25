import { TestBed } from '@angular/core/testing';
import { NetworkService } from './network.service';

describe('NetworkService', () => {
  let service: NetworkService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NetworkService);
  });

  afterEach(() => {
    service.destroy();
  });

  it('should report online status from navigator.onLine', () => {
    expect(service.isOnline()).toBe(navigator.onLine);
  });

  it('should update isOnline when going offline', () => {
    service.isOnline.set(true);
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);
  });

  it('should update isOnline when going online', () => {
    service.isOnline.set(false);
    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
  });

  it('should clean up listeners on destroy', () => {
    const spy = vi.spyOn(window, 'removeEventListener');
    service.destroy();
    expect(spy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(spy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});

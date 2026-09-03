import { TestBed } from '@angular/core/testing';
import { DataVersionService } from './data-version.service';

describe('DataVersionService', () => {
  let service: DataVersionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataVersionService);
  });

  it('starts at version 0', () => {
    expect(service.version()).toBe(0);
  });

  it('increments the version on bump', () => {
    service.bump();
    expect(service.version()).toBe(1);

    service.bump();
    expect(service.version()).toBe(2);
  });

  it('shares the version across consumers', () => {
    const first = TestBed.inject(DataVersionService);
    const second = TestBed.inject(DataVersionService);

    first.bump();

    expect(second.version()).toBe(1);
  });
});

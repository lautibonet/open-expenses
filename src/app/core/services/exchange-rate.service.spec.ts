import { TestBed } from '@angular/core/testing';
import { ExchangeRateService } from './exchange-rate.service';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExchangeRateService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return rate 1 when from and to are the same currency', async () => {
    const result = await service.getRate('EUR', 'EUR');
    expect(result.rate).toBe(1);
    expect(result.from).toBe('EUR');
    expect(result.to).toBe('EUR');
  });

  it('should normalize currencies to uppercase', async () => {
    const result = await service.getRate('eur', 'eur');
    expect(result.rate).toBe(1);
    expect(result.from).toBe('EUR');
    expect(result.to).toBe('EUR');
  });

  it('should fetch rate from Frankfurter API', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ rates: { USD: 1.08 }, date: '2026-01-15' }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await service.getRate('EUR', 'USD', '2026-01-15');

    expect(result.rate).toBe(1.08);
    expect(result.from).toBe('EUR');
    expect(result.to).toBe('USD');
    expect(result.date).toBe('2026-01-15');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/2026-01-15?from=EUR&to=USD',
    );
  });

  it('should use latest when no date provided', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ rates: { GBP: 0.85 }, date: '2026-01-15' }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await service.getRate('EUR', 'GBP');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/latest?from=EUR&to=GBP',
    );
    expect(result.rate).toBe(0.85);
  });

  it('should throw on HTTP error', async () => {
    const mockResponse = {
      ok: false,
      statusText: 'Not Found',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    await expect(service.getRate('EUR', 'XYZ')).rejects.toThrow('Exchange rate API failed: Not Found');
  });

  it('should throw when target currency missing from response', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ rates: {}, date: '2026-01-15' }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    await expect(service.getRate('EUR', 'XYZ')).rejects.toThrow('Rate not available for XYZ');
  });

  it('should throw on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(service.getRate('EUR', 'USD')).rejects.toThrow('Failed to fetch');
  });
});

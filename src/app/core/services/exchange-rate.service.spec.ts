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
      json: async () => ({ base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 1.08 }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await service.getRate('EUR', 'USD', '2026-01-15');

    expect(result.rate).toBe(1.08);
    expect(result.from).toBe('EUR');
    expect(result.to).toBe('USD');
    expect(result.date).toBe('2026-01-15');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rate/EUR/USD?date=2026-01-15',
    );
  });

  it('should use latest when no date provided', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ base: 'EUR', quote: 'GBP', date: '2026-01-15', rate: 0.85 }),
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

    const result = await service.getRate('EUR', 'GBP');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rate/EUR/GBP',
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

  describe('getRates (batch)', () => {
    it('should fetch multiple rates in one call', async () => {
      const mockResponse = {
        ok: true,
        json: async () => [
          { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 1.08 },
          { base: 'EUR', quote: 'GBP', date: '2026-01-15', rate: 0.85 },
        ],
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      const result = await service.getRates('EUR', ['USD', 'GBP'], '2026-01-15');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.frankfurter.dev/v2/rates?base=EUR&quotes=USD,GBP&date=2026-01-15',
      );
      expect(result.base).toBe('EUR');
      expect(result.date).toBe('2026-01-15');
      expect(result.rates.size).toBe(2);
      expect(result.rates.get('USD')).toBe(1.08);
      expect(result.rates.get('GBP')).toBe(0.85);
    });

    it('should use latest when no date provided', async () => {
      const mockResponse = {
        ok: true,
        json: async () => [
          { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 1.08 },
        ],
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      await service.getRates('EUR', ['USD']);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.frankfurter.dev/v2/rates?base=EUR&quotes=USD',
      );
    });

    it('should return rate 1 for same-currency quote', async () => {
      const mockResponse = {
        ok: true,
        json: async () => [
          { base: 'EUR', quote: 'EUR', date: '2026-01-15', rate: 1 },
        ],
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      const result = await service.getRates('EUR', ['EUR']);

      expect(result.rates.get('EUR')).toBe(1);
    });

    it('should throw on HTTP error', async () => {
      const mockResponse = { ok: false, statusText: 'Not Found' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      await expect(service.getRates('EUR', ['USD'])).rejects.toThrow('Exchange rate API failed: Not Found');
    });

    it('should throw when no quotes provided', async () => {
      await expect(service.getRates('EUR', [])).rejects.toThrow('At least one quote currency is required');
    });

    it('should throw on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(service.getRates('EUR', ['USD'])).rejects.toThrow('Failed to fetch');
    });

    it('should cache results and not refetch on repeated calls', async () => {
      const mockResponse = {
        ok: true,
        json: async () => [
          { base: 'EUR', quote: 'USD', date: '2026-01-15', rate: 1.08 },
        ],
      };
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as Response);

      const first = await service.getRates('EUR', ['USD'], '2026-01-15');
      const second = await service.getRates('EUR', ['USD'], '2026-01-15');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });
  });
});

# Currency-aware Transfer model

Transfers now store `sourceAmount`, `destinationAmount`, `exchangeRate`, and `baseCurrencyAmount` instead of a single `amount` field. For same-currency transfers, `sourceAmount` equals `destinationAmount`.

This was chosen because cross-currency transfers require tracking both sides independently — the source debits one currency and the destination credits another at the prevailing exchange rate. Without stored rates and both amounts, the dashboard balance calculation and movements display would need to re-convert at read time, which is fragile and inconsistent with how Transactions already work.

The alternative was to keep a single amount and derive the other side on the fly, but this breaks down when the exchange rate changes between creation and display, and makes period totals unreliable. The cost is a data migration for existing transfers, but the dataset is small and local-first.

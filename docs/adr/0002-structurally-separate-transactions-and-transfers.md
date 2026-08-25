# Structurally separate Transactions and Transfers

Transfers and Transactions are fully separate data stores, not a shared table with a type discriminator.

This was chosen because it makes accidentally including a Transfer in an Income/Expense aggregate structurally impossible — not just filtered out at query time. The alternative (single `Movement` table with a `type` column) is simpler to query but requires discipline at every aggregation point to exclude Transfers, which is error-prone over time.

The cost is two tables and two service layers instead of one, but the domain is small enough that this overhead is negligible.

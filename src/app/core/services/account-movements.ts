import { db } from '../db/database';

/* ADR 0018: an Account has movements when any Transaction references it or
   any Transfer references it on either side. A plain function so callers
   that are not DI-injected (the Payment Category module's card deletion) can
   reuse the same rule. */
export async function accountHasMovements(id: number): Promise<boolean> {
  const inTransactions = await db.transactions.where('accountId').equals(id).count();
  if (inTransactions > 0) return true;
  const asSource = await db.transfers.where('sourceAccountId').equals(id).count();
  if (asSource > 0) return true;
  return (await db.transfers.where('destinationAccountId').equals(id).count()) > 0;
}

/* ADR 0025: the dataset has movements when any Transaction or Transfer
   exists, on any Account, active or deactivated. */
export async function hasAnyMovements(): Promise<boolean> {
  if ((await db.transactions.count()) > 0) return true;
  return (await db.transfers.count()) > 0;
}

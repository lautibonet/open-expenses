import { Table } from 'dexie';
import { ScopeAwareMovement, movementInScope } from '../types/period.type';
import { PeriodScope } from '../scope/scope';

/* The movements of a store that fall inside the Scope. A month Scope narrows
   through the `period` index first; a year Scope scans the table, since
   movements without a stored year resolve theirs from the date. */
export async function queryByScope<T extends ScopeAwareMovement>(
  table: Table<T>,
  scope: PeriodScope,
): Promise<T[]> {
  const candidates =
    scope.kind === 'year'
      ? await table.toArray()
      : await table.where('period').equals(scope.period).toArray();
  return candidates.filter(movement => movementInScope(movement, scope));
}

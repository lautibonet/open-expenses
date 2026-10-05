import { computed, signal } from '@angular/core';
import { DeletionPlan } from '../../core/models/deletion-plan';

export interface DeleteTarget {
  kind: 'account' | 'card' | 'category';
  id: number;
}

export interface DeleteActions<P extends DeletionPlan> {
  plan: () => Promise<P>;
  remove: () => Promise<P>;
}

interface Slot<P extends DeletionPlan> {
  target: DeleteTarget;
  state: 'confirming' | 'refused';
  plan: P;
  remove: () => Promise<P>;
}

function sameTarget(a: DeleteTarget, b: DeleteTarget): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/* The Delete flow (ADR 0018, ADR 0027) shared by every Settings row: one
   slot for the whole page, so at most one row of any kind is confirming or
   refused. `P` is the widest plan the rows answer with. */
export function createDeleteFlow<P extends DeletionPlan = DeletionPlan>() {
  const slot = signal<Slot<P> | null>(null);
  /* The request whose plan is being fetched. Any later request or a cancel
     replaces it, so a plan the user has since moved away from is dropped
     instead of opening a stale confirm. */
  let latestRequest: object | null = null;

  function holds(target: DeleteTarget, state: Slot<P>['state']): boolean {
    const current = slot();
    return current !== null && current.state === state && sameTarget(current.target, target);
  }

  return {
    async request(target: DeleteTarget, actions: DeleteActions<P>): Promise<void> {
      slot.set(null);
      const request = {};
      latestRequest = request;
      const plan = await actions.plan();
      if (latestRequest !== request) return;
      latestRequest = null;
      slot.set({
        target,
        state: plan.kind === 'refused' ? 'refused' : 'confirming',
        plan,
        remove: actions.remove,
      });
    },
    /* Runs the delete captured at request. The slot clears first; a delete
       the data now refuses reopens it as a refusal and answers null. */
    async confirm(): Promise<P | null> {
      const current = slot();
      if (current?.state !== 'confirming') return null;
      slot.set(null);
      const answer = await current.remove();
      if (answer.kind === 'refused') {
        slot.set({ ...current, state: 'refused', plan: answer });
        return null;
      }
      return answer;
    },
    cancel(): void {
      latestRequest = null;
      slot.set(null);
    },
    /* The plan behind the open confirm or refusal, if any. */
    plan: computed(() => slot()?.plan ?? null),
    isConfirming: (target: DeleteTarget) => holds(target, 'confirming'),
    isRefused: (target: DeleteTarget) => holds(target, 'refused'),
  };
}

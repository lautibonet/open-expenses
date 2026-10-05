/* ADR 0027: every deletion answers with a plan. Refusal under
   delete-if-unused (ADR 0018) is an expected answer, not an error; `proceed`
   may carry extra detail, as the card's paired-category outcome does. */
export type DeletionPlan = { kind: 'refused'; reason: 'movements' } | { kind: 'proceed' };

export const REFUSED_FOR_MOVEMENTS = { kind: 'refused', reason: 'movements' } as const;
export const PROCEED = { kind: 'proceed' } as const;

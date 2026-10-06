import { DeletionPlan } from '../../core/models/deletion-plan';
import { createDeleteFlow, DeleteTarget } from './delete-flow';

const PROCEED: DeletionPlan = { kind: 'proceed' };
const REFUSED: DeletionPlan = { kind: 'refused', reason: 'movements' };

const account: DeleteTarget = { kind: 'account', id: 1 };

function actions(plan: DeletionPlan, removed: DeletionPlan = plan) {
  return {
    plan: () => Promise.resolve(plan),
    remove: vi.fn(() => Promise.resolve(removed)),
  };
}

describe('createDeleteFlow', () => {
  it('opens the confirm for a row whose plan proceeds', async () => {
    const flow = createDeleteFlow();

    await flow.request(account, actions(PROCEED));

    expect(flow.isConfirming(account)).toBe(true);
    expect(flow.isRefused(account)).toBe(false);
  });

  it('refuses a row whose plan is refused, without opening a confirm', async () => {
    const flow = createDeleteFlow();

    await flow.request(account, actions(REFUSED));

    expect(flow.isRefused(account)).toBe(true);
    expect(flow.isConfirming(account)).toBe(false);
  });

  it('holds one delete for the whole page: a card request closes an account confirm', async () => {
    const flow = createDeleteFlow();
    const card: DeleteTarget = { kind: 'card', id: 1 };

    await flow.request(account, actions(PROCEED));
    await flow.request(card, actions(REFUSED));

    expect(flow.isConfirming(account)).toBe(false);
    expect(flow.isRefused(card)).toBe(true);
  });

  it('closes the open confirm as soon as another delete is requested', async () => {
    const flow = createDeleteFlow();
    const category: DeleteTarget = { kind: 'category', id: 2 };
    let resolvePlan!: (plan: DeletionPlan) => void;

    await flow.request(account, actions(PROCEED));
    const pending = flow.request(category, {
      plan: () => new Promise<DeletionPlan>((resolve) => (resolvePlan = resolve)),
      remove: vi.fn(),
    });

    expect(flow.isConfirming(account)).toBe(false);
    resolvePlan(PROCEED);
    await pending;
    expect(flow.isConfirming(category)).toBe(true);
  });

  it('drops a plan that arrives after the user has moved on to another row', async () => {
    const flow = createDeleteFlow();
    const category: DeleteTarget = { kind: 'category', id: 2 };
    let resolveSlow!: (plan: DeletionPlan) => void;

    const slow = flow.request(account, {
      plan: () => new Promise<DeletionPlan>((resolve) => (resolveSlow = resolve)),
      remove: vi.fn(),
    });
    await flow.request(category, actions(PROCEED));
    resolveSlow(PROCEED);
    await slow;

    expect(flow.isConfirming(account)).toBe(false);
    expect(flow.isConfirming(category)).toBe(true);
  });

  it('cancel closes an open confirm', async () => {
    const flow = createDeleteFlow();
    await flow.request(account, actions(PROCEED));

    flow.cancel();

    expect(flow.isConfirming(account)).toBe(false);
  });

  it('cancel closes an open refusal', async () => {
    const flow = createDeleteFlow();
    await flow.request(account, actions(REFUSED));

    flow.cancel();

    expect(flow.isRefused(account)).toBe(false);
  });

  it('cancel drops a plan still being fetched', async () => {
    const flow = createDeleteFlow();
    let resolvePlan!: (plan: DeletionPlan) => void;
    const pending = flow.request(account, {
      plan: () => new Promise<DeletionPlan>((resolve) => (resolvePlan = resolve)),
      remove: vi.fn(),
    });

    flow.cancel();
    resolvePlan(PROCEED);
    await pending;

    expect(flow.isConfirming(account)).toBe(false);
  });

  it('confirm runs the delete captured at request and returns the plan it answered with', async () => {
    const flow = createDeleteFlow();
    const deleted = actions(PROCEED);
    await flow.request(account, deleted);

    expect(await flow.confirm()).toEqual(PROCEED);

    expect(deleted.remove).toHaveBeenCalledTimes(1);
    expect(flow.isConfirming(account)).toBe(false);
  });

  it('confirm turns into a refusal when the delete is refused since the plan', async () => {
    const flow = createDeleteFlow();
    await flow.request(account, actions(PROCEED, REFUSED));

    expect(await flow.confirm()).toBeNull();

    expect(flow.isRefused(account)).toBe(true);
  });

  it('confirm does nothing when no confirm is open', async () => {
    const flow = createDeleteFlow();
    const refused = actions(REFUSED);
    await flow.request(account, refused);

    expect(await flow.confirm()).toBeNull();

    expect(refused.remove).not.toHaveBeenCalled();
    expect(flow.isRefused(account)).toBe(true);
  });

  it('exposes the plan of the row under confirm, and none once it closes', async () => {
    type CardPlan = DeletionPlan | { kind: 'proceed'; category: 'delete'; categoryName: string };
    const flow = createDeleteFlow<CardPlan>();
    const card: DeleteTarget = { kind: 'card', id: 3 };
    const cardPlan: CardPlan = { kind: 'proceed', category: 'delete', categoryName: 'Visa payment' };

    await flow.request(card, { plan: () => Promise.resolve(cardPlan), remove: vi.fn() });
    expect(flow.plan()).toEqual(cardPlan);

    flow.cancel();
    expect(flow.plan()).toBeNull();
  });

  it('lets an error thrown by the delete pass through, leaving no row open', async () => {
    const flow = createDeleteFlow();
    await flow.request(account, {
      plan: () => Promise.resolve(PROCEED),
      remove: () => Promise.reject(new Error('errors.accountNotFound')),
    });

    await expect(flow.confirm()).rejects.toThrow('errors.accountNotFound');

    expect(flow.isConfirming(account)).toBe(false);
    expect(flow.isRefused(account)).toBe(false);
  });
});

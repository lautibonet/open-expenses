import { DeleteTarget } from '../delete-flow';

/* The translation keys a Settings row's delete controls and refusal speak,
   per kind of target. A card is an Account (ADR 0022), so it is refused
   with the account's message. */
export interface DeleteCopy {
  deleteAria: string;
  prompt: string;
  refusal: string;
}

export const DELETE_COPY: Record<DeleteTarget['kind'], DeleteCopy> = {
  account: {
    deleteAria: 'settings.deleteAccountAria',
    prompt: 'settings.accountDeletePrompt',
    refusal: 'errors.accountHasMovements',
  },
  card: {
    deleteAria: 'settings.deleteCardAria',
    prompt: 'settings.cardDeletePrompt',
    refusal: 'errors.accountHasMovements',
  },
  category: {
    deleteAria: 'settings.deleteCategoryAria',
    prompt: 'settings.categoryDeletePrompt',
    refusal: 'errors.categoryHasMovements',
  },
};

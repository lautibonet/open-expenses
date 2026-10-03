/* Issue #180: Account and Category names are unique ignoring letter case —
   "Visa" and "visa" cannot both exist. Surrounding whitespace never counts
   either, since the services trim before storing. The services and
   Onboarding's staged checks share this one rule so they never disagree. */
export function namesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/* Whether `name` is taken by an item other than the one being renamed;
   `isSelf` marks that item, so it may change the capitalisation of its own
   name. */
export function isNameTaken<T extends { name: string }>(
  items: readonly T[],
  name: string,
  isSelf: (item: T, index: number) => boolean = () => false,
): boolean {
  return items.some((item, index) => !isSelf(item, index) && namesMatch(item.name, name));
}

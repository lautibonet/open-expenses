# Services throw translation keys, UI translates

Service validation errors were thrown as raw English strings (`Error('Account name is required')`) and the UI displayed `e.message` untranslated, so Spanish-language users saw English errors. We decided services throw stable translation **keys** (e.g. `errors.accountNameRequired`) with the display point resolving them through `language.t()`, keeping all human-readable wording in the single `translations.ts` map and leaving services free of any language dependency. Existing scattered keys (e.g. `onboarding.accounts.nameRequired`) consolidate under shared `errors.*` keys; `{param}` interpolation covers parameterized messages like uniqueness violations.

## Considered Options

- **Inject `LanguageService` into services and throw translated messages** — rejected: couples domain services to presentation, and an error thrown before a language switch renders stale.
- **Map English messages to keys at the UI boundary** — rejected: brittle string matching, silently breaks when wording changes.

## Consequences

- Every user-visible thrown error must have a key in both `en` and `es` maps; `translate()`'s English fallback is the safety net for missing keys, not a license to throw English.
- Error display placement (page-level alert vs inline in an edit state) is a UI concern and may vary per flow without touching services.

# Coding standards

Judgement calls for review. Mechanical rules are enforced by tools, not listed here: `npm run typecheck`, `npm run test:quiet` (including the translation-parity test) and `npm run knip` (unused files, exports and dependencies) all run in CI.

## Domain language

Names in code, tests and UI copy use the terms defined in `CONTEXT.md`. A synonym listed under a term's _Avoid_ (for example "Entry" for Transaction, "Wallet" for Account) is a finding, as is a new concept the glossary has no term for. The fix is to add the term to `CONTEXT.md` in the same change.

## Decisions

The change respects every ADR in `docs/adr/` that covers the code it touches. Code that departs from an ADR ships with a new ADR in the same change that names the one it narrows or supersedes (as ADR 0027 does for ADR 0012).

The code that enforces a decision carries a block comment that says why and cites its source: `/* … (ADR 0018) */` or `/* Issue #189: … */`. The comment states the rule, not the mechanics, and matches the comment density of the surrounding file.

## Errors and outcomes

Services throw `TranslationError` with a translation key for genuine errors, and the UI translates them (ADR 0012). An answer the user is expected to hear, such as a refusal under delete-if-unused, is returned as a result, not thrown (ADR 0027).

## Names

A name says what the thing means to the caller, not how it is built: `latestRequest` over `pending`, `answer` over `done`. A boolean reads as a question (`hasMovements`, `isConfirming`).

## One owner per behaviour

Behaviour shared by sibling rows, forms or services lives in one unit that each caller uses, not in copies kept in step by hand. A change that adds a second copy of an existing flow is a finding.

## Tests

Tests drive public interfaces (a service method, a component's template or public signals), not private state. Test names describe behaviour in domain language. A bug fix comes with a test that fails without it.

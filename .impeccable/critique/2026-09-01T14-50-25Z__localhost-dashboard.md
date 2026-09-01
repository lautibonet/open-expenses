---
target: "the stats page at http://localhost:4200/dashboard"
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-09-01T14-50-25Z
slug: localhost-dashboard
---
⚠️ DEGRADED: single-context (no live-browser session available this round; critique rests on a dual-agent source review + the deterministic CLI scan, no live overlay, no viewport evidence)

# Design Critique — Stats Page (`/dashboard`) — re-run after the critique close-out

**Method: dual-agent (A: ses_fa291b463ffenhWKb9X57kOYUf · B: ses_fa29198cbffe1Kc5rNvPrjOtkm), synthesized by the driving agent.**

*No browser automation was available (no playwright/puppeteer cached, MCP browser session unavailable), so there is no live-browser overlay; the critique rests on source review + the deterministic CLI scan. Baseline for comparison: 2026-09-01T10-33-05Z (26/40, Acceptable).*

## Design Health Score

| # | Heuristic | Baseline | Now | Key Issue |
|---|-----------|----------|-----|-----------|
| 1 | Visibility of System Status | 2 | 1 | No loading/busy state: the async load paints a false "No movements in {year}" empty state and €0 figures before data arrives; scope changes give zero feedback. (Baseline's other half — the silent missing-rate drop — is fixed and now credited under #5.) |
| 2 | Match System / Real World | 2 | 3 | Honest scoping: KPI cards state their year, balances are period-end of the selected Period, and the 12-month strip heading now states the year scope. Remaining: monthly averages divide by months-with-data without the caption saying so. |
| 3 | User Control and Freedom | 3 | 3 | Read-only page with reversible scope; the dismissible conversion warning is the only irrecoverable act. |
| 4 | Consistency and Standards | 3 | 4 | One negative-ink grammar recorded across pages; card padding back to the 1rem DESIGN.md spec; currency shown once per balance row (mono tile); shared patterns used faithfully. P2 remains: card headers lack the 1px divider DESIGN.md prescribes (shared `%card-header` pattern, deferred as page-scoped ticket). |
| 5 | Error Prevention | 3 | 4 | Unconverted-transaction detection, missing-rate check, offline exclusion, stored-conversions-only sums (ADR 0013); grid blowout pre-empted with minmax(0,1fr). |
| 6 | Recognition Rather Than Recall | 2 | 3 | Every section restates its scope; year labels on KPIs; currency tile per balance row. Remaining: the strip's exact Net values live only in a visually-hidden list — sighted users must interpolate bar heights. |
| 7 | Flexibility and Efficiency | 2 | 2 | The 12-month trend spine now exists, but there is no scope deep-linking in the URL, no click-through from strip/category to filtered Movements, and comparing two months still means flipping selects. (Panels A and B both landed on 2: the added trend is real but the comparison/shortcut gaps dominate.) |
| 8 | Aesthetic and Minimalist Design | 4 | 4 | Token-only styling, zero-radius hard strokes, mono tabular figures, earned inversion; the spec-drift items (padding, duplicated currency, faux-bold weights, color grammar) are all closed. |
| 9 | Error Recovery | 3 | 2 | The warning strip covers excluded accounts and unconverted sums, and data-version changes auto-reload — but a failed rate fetch has no retry affordance, and dismissing the page's single disclosure is irreversible. (The silent-path surface the baseline flagged is fixed; the panels weighed the irrecoverable dismissal + no-retry pair more heavily than the baseline did.) |
| 10 | Help and Documentation | 2 | 3 | Targeted empty states with interpolated year/scope for every section. Remaining: bare one-liners with no next-step guidance ("record movements in Movements"). |
| **Total** | | **26/40** | **29/40** | **Good** |

**Improvement documented: 26/40 (Acceptable) → 29/40 (Good), +3.** Score deltas reflect issue re-attribution and stricter panel weighting of the remaining gaps, not behavioral regressions: every invariant from the sibling tickets (#83 deep links, #84 scope honesty, #85 period-end equality, #87 warning coverage, #88 year spine, #89 zero states, #90 one color grammar) still holds — full test suite green (708/708). Closed this pass (#91): card padding to the 1rem spec, currency-once per balance row, year scope on the strip heading.

Cognitive load: 1/8 checklist failures (chunking — the category list is unbounded). Working-memory failure from the baseline (mixed time scopes with no on-screen reminder) is resolved: every figure's scope is on-screen. Low band.

## Design Specificity Verdict

**Verdict: authored.** The inverted solid-ink Net card, the `AVG €X/MO` spreadsheet-native captions, mono tabular figures everywhere, chart-lib-free bars and the 12-month ink strip are all Monolith-Ledger-native. The restored 1rem card padding and single-currency tile rows deepen the system rather than dilute it.

**Deterministic scan:** 1 advisory finding (`design-system-color`: "rgb(0,0,0) text outside DESIGN.md" at `dashboard.component.html` line 0). Judged a **false positive** — same finding as the baseline; the static jsdom engine doesn't load Angular `styleUrl` SCSS, so the element falls back to the UA default black; the authored color is `var(--on-surface)`. No real rule fired.

**Visual overlays:** none — no browser session could be launched.

## Overall Impression

The page no longer lies about time: every figure states its scope, the balance rows carry their currency exactly once, and the cards sit on the design spec's 1rem padding. What remains is execution polish, not structure: an async flash pretending to be "no data", a self-erasing disclaimer, and values the strip only shows to screen readers.

## What's Working

1. **Honest scoping discipline** — KPI year labels, period-scoped month headings, year-scoped strip heading, period-end balances with stable stored conversions; no figure is unlabeled or rate-drifting.
2. **Degradation-not-failure sums** — offline/missing-rate/unconverted paths all route to an explicit warning instead of a silently wrong total.
3. **Accessible chart fallback** — aria-hidden strip plus a visually-hidden month/Net list, labelled selects, polite scope announcements, targeted empty states.

## Priority Issues

1. **[P0] No loading/async state — a false "no data" flash.** Signals start at 0/`yearHasData=false`, so first paint and every scope change renders the KPI empty state and €0.00 figures before the DB reads resolve. **Fix:** a busy state (or skeleton) until the first successful load completes, and aria-busy on the data region. → `/impeccable harden`
2. **[P1] The total's vouching disclaimer is dismissible and irrecoverable.** After dismissal, "All accounts (EUR)" keeps claiming all accounts while foreign ones are silently excluded (offline/missing rate). **Fix:** keep an unobtrusive marker on the figure itself when degraded (e.g. a caps `· BASE ONLY` suffix), or make the warning re-assert on refresh. → `/impeccable clarify`
3. **[P1] Net strip values unreadable to sighted users.** Bars are relative and `aria-hidden`; exact figures exist only in a visually-hidden list. **Fix:** a small mono figure on hover/focus, or make the strip months keyboard-focusable and announce values on focus. → `/impeccable polish`
4. **[P1] No retry after a rate-fetch failure.** The catch path excludes foreign accounts permanently until something else triggers a reload. **Fix:** a retry affordance on the warning strip. → `/impeccable harden`

## Persona Red Flags

**Alex (impatient power user):** Comparing two months = flip two selects, memorize, repeat. Scope changes re-read full tables three times (`refresh`/`refreshAverages`/`applyScopeOptions`) with no progress feedback. No URL scope state, no shortcut, no click-through from strip/category into Movements.

**Sam (screen reader + keyboard):** Strong baseline — labelled selects, polite scope announcements, textual empty states, hidden figure list. Remaining: the SR Net list doesn't mark which month is current (only the visual border does); the dismissible warning can be tabbed past and dismissed, losing the caveat that qualifies the total; no "figures refreshed" completion announcement after a scope change.

## Minor Observations

- Card headers lack the 1px divider DESIGN.md:174 prescribes — lives in the shared `%card-header` pattern, so it is a cross-page fix, deferred from this page-scoped ticket.
- Three full-table reads per scope change (`getAll` in `refresh`, `refreshAverages`, `applyScopeOptions`) — sluggish on large ledgers; a shared query cache would collapse them.
- Route is `/dashboard` while nav and h1 say "Stats" — cosmetic identity mismatch (deferred; renaming routes would break deep links).
- Two divider tokens on one page (balance rows `--surface-container-low`, bar tracks `--outline-variant`) — both sanctioned, unexplained.
- Empty states give no next-step guidance (e.g., "record movements in Movements").

## Recommended Actions

- `/impeccable harden`: busy/loading state (P0) + retry affordance on the conversion warning.
- `/impeccable clarify`: degraded-total marker so "All accounts" stays honest after dismissal.
- `/impeccable polish`: visible-value affordance on the Net strip.
- `/impeccable document`: card-header divider spec into the shared pattern (cross-page).

---
target: "the movements page (http://localhost:4200/movements)"
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-09-01T15-24-35Z
slug: rc-app-features-movements-movements-component-html
---
# Design Critique — Movements Page (`/movements`)

Method: dual-agent (A: ses_fa2774bddffeupMSeSrCfwxGCW · B: ses_fa27723c3ffeXqu4sGinlOmU5d)
Target: src/app/features/movements/movements.component.html (live: http://localhost:4200/movements)
Note: browser automation is unavailable in this harness (no Playwright/Puppeteer), so no visual overlay/injection was run; both assessments are source-based.

## Design Health Score — 25/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | First paint renders a false "No movements for {scope}" empty state + €0.00 net before the async load resolves (movements.component.ts:80-91, html:474-487) |
| 2 | Match System / Real World | 3 | Date + Period + Year coexist per capture with zero on-screen explanation of their relationship |
| 3 | User Control and Freedom | 3 | Undo/cancel/clear-filters are strong, but no Esc close and unsaved form data is silently destroyed |
| 4 | Consistency and Standards | 2 | Note lives under Category for transactions but under Account for transfers (html:287 vs 387); quick-add defaults Period to *now*, transfer form to *Scope*; forms render on opposite sides of their triggers (html:39-48 vs 66-214); DESIGN.md:237's month group headers absent |
| 5 | Error Prevention | 3 | Inline tick/X confirm + focus handoff + 10s undo + self-transfer blocked; but no guard on form-wiping clicks, no field-level validation |
| 6 | Recognition Rather Than Recall | 2 | Icon-only row actions with hover-only tooltips; the 'N' shortcut is documented nowhere ('T' only as a title attr); direction has no text signal anywhere |
| 7 | Flexibility and Efficiency | 2 | n/t shortcuts + remembered last account/category exist; no URL scope state, no bulk actions, no pagination |
| 8 | Aesthetic and Minimalist Design | 3 | Token-pure and sparse; slight noise from three add-entry points and two control clusters before content |
| 9 | Error Recovery | 3 | Specific plain copy ("You are offline. Enter the exchange rate manually."), form state preserved; but no retry affordance and save-failure detail only on hover (html:205) |
| 10 | Help and Documentation | 2 | Targeted empty states with next-step copy; no help surface for the Period-vs-Date confusion |
| **Total** | | **25/40** | **Acceptable — significant improvements needed before daily-driver quality** |

## Design Specificity Verdict

**Authored — 8/10.** This page could not be transplanted to a generic SaaS product without losing its meaning, because the visual grammar *is* the data model: direction is carried by 4px stripes and directional amount ink with transfers deliberately neutralized (movements.component.scss:208-225), amounts are always-positive mono tabular figures with `→` conversion arrows (movements.component.ts:787-810), and the blue FX well is reserved exactly for the one moment currency conversion becomes live. The two capture forms are the least authored elements — generic two-column stacked-label grids with no compositional point of view, and DESIGN.md:187's promised "amount column gets the widest track" compact mode doesn't exist. Deductions are for drift from the system's own spec (missing month group headers, the always-green net-flow stripe), not for genericness.

**Deterministic scan:** 3 advisory findings, all `design-system-color` ("rgb(0,0,0) text outside DESIGN.md", `line: 0`), all judged **false positives** — the static jsdom engine never loads Angular `styleUrl` SCSS, so elements authored via `@extend %page-header` / `%caps-label-muted` / `%empty-state` (resolving to `var(--on-surface)` / `var(--on-surface-variant)`) fall back to the UA default black. Zero literal color values exist anywhere in `src/app/features/movements/**` — the page is *more* system-compliant than the scan suggests. The detector caught nothing material a manual review would miss.

**Visual overlays:** none — no browser automation available (no Playwright/Puppeteer in harness or project), so injection was skipped and no user-visible overlay exists. The page remains live at http://localhost:4200/movements for manual checks.

## Overall Impression

The ledger grammar is real and the safety choreography around deletion is the best in the app. But the page's async spine lies to the user at first paint — a financial tool that flashes "no movements" while loading — and the capture forms, which are the page's actual job, still carry pre-system weight: seven flat fields, two contradictory Period grammars, and a trigger that silently erases your typed work. Fix the three P1s and this jumps a band.

## What's Working

1. **Direction as dual-channel ledger grammar** — 4px stripes + directional ink, transfers neutralized with background tint, with the decision documented in-source (movements.component.scss:208-225, 274-276).
2. **Three-layer delete recovery** — inline confirm with focus handoff (ts:169-173), SR announcement of exactly what's being deleted (html:298-301), pause-on-hover/focus undo toast (html:496-499). Textbook peak-end handling of the most feared action.
3. **Honest cross-currency figures** — `$10.00 → €8.57` in mono tabular cells (movements.component.ts:787-810), with the FX well appearing only when actually needed (quick-add-card.component.html:107).

## Priority Issues

1. **[P1] False "no data" state during async load.** *What:* signals initialize empty; first paint shows the empty state and €0.00 net until IndexedDB resolves (movements.component.ts:80-91, html:474-487). *Why:* the page's first impression claims your ledger is empty — trust damage in a financial tool; same defect family the Stats critique flagged as P0. *Fix:* gate the empty state and net card behind a loaded/busy signal with `aria-busy`. — `/impeccable harden`
2. **[P1] Unsaved form data silently destroyed.** *What:* clicking "+ Transfer" while the transfer form is open re-runs `openTransferForm()` and resets it (no toggle guard, unlike quick-add's); switching forms unmounts the other (ts:350-351, 384-397; html:59-61). *Why:* one accidental click on the sibling trigger (or the 'T' key) erases typed amounts. *Fix:* toggle the transfer trigger like quick-add, confirm before form switches, or persist draft state. — `/impeccable harden`
3. **[P1] Direction has no non-visual signal.** *What:* income/expense/transfer is encoded only as stripe + amount color; no SR text or glyph exists (html:279-296, 377-390). *Why:* a screen-reader user cannot tell money-in from money-out in their own ledger — the page's most important fact is color-only (WCAG 1.4.1). *Fix:* visually-hidden "income/expense/transfer" suffix per row, or a visible caps tag. — `/impeccable audit`
4. **[P2] Net Flow card: unconditional green stripe + unstated scope.** *What:* `border-left: var(--stripe-income)` fires even when net is negative; heading says just "Net Flow" (net-flow-card.component.scss:6, html:2). *Why:* green means money-in in this system (DESIGN.md:149-157) — a green-flagged negative net contradicts the Ledger Green and Negative-Stays-Ink rules; scope is lost once scrolled. *Fix:* neutral (or sign-aware) stripe; append the Period to the caps heading. — `/impeccable polish`
5. **[P2] Contradictory Period defaults between the two capture forms.** *What:* transfer form defaults Period/Year to the browsed Scope while date defaults to today (ts:394-395); quick-add defaults Period/Year to *now* regardless of Scope (quick-add-card.component.ts:77-79). *Why:* a transfer captured with date=today files under March — silently mis-filed reporting data; same field, two grammars. *Fix:* one rule: derive Period from Date by default, overridable, in both forms. — `/impeccable harden`

## Persona Red Flags

**Alex (impatient power user):** the 'N' shortcut is documented nowhere and 'T' only as a hover tooltip (ts:159-163; translations.ts:141-142); unused `sortNewest`/`sortOldest` strings hint at an abandoned visible sort control; no URL scope state so March can't be bookmarked or shared; single-item CRUD only; clicking "+ Transfer" while open wipes the form.

**Sam (screen reader + keyboard):** row direction is color-only (issue 3); 1.75rem icon buttons (_patterns.scss:85-97) are small keyboard targets; the delete-confirm focus handoff (ts:169-173) and global `:focus-visible` are excellent, but the undo toast's 10s expiry is never announced and a scope change has no completion announcement beyond the scope name (html:62).

**Casey (distracted mobile user):** 5-column table with nowrap mono amounts and mediumDate dates → horizontal scroll pushes Edit/Delete (last column) off-screen; 28px touch targets; Period/Year selects add two taps to every capture; the undo toast correctly clears the bottom nav (movements.component.scss:352-356) — one thing done right for the thumb.

## Minor Observations

- Stale comment at movements.component.scss:208-210 references month group headers that don't exist in the markup; DESIGN.md:237 promises them too.
- Transfer rows render the note under the "Account" header (html:386-390); the "Category / Transfer" header doubles for two row semantics.
- Category filter silently excludes all transfers (ts:218-224).
- Net-flow totals include unconverted foreign transactions at face value with no warning (net-flow-card.component.ts:26-32) — Stats has a warning strip for exactly this; Movements doesn't.
- Transfer's destination amount is editable and doesn't back-compute the rate (html:182-186); quick-add's equivalent is readonly — inconsistent.
- Save buttons disable without any inline reason in both forms.
- 10s undo window, no countdown, dismiss is final.
- Empty state's next step is prose, not a button.
- Three entry points for capture (sidebar Quick Add, "+ Transaction", 'N') with different toggle behaviors.

## Questions to Consider

1. Your own source comment calls stripes "the type's only signal" (movements.component.scss:208-210) — so what is a green stripe doing on a derived, non-directional Net figure, and what does that leave green *meaning*?
2. The domain says dates are informational and reporting runs on stored Period — why does the UI lead with Date in every row and ask users to reconcile three time fields per capture instead of deriving Period and hiding it?
3. Quick Add "closes after a successful save" (CONTEXT.md:44) — is a mid-page vanishing form the right end state, or should the new row scroll into view and confirm itself so you see where the money landed?

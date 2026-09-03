---
target: movements page, mobile view
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-09-02T10-38-24Z
slug: src-app-features-movements
---
⚠️ DEGRADED: single-context (Assessment B — detector + browser evidence — skipped at user request; Assessment A ran as an isolated sub-agent)

Target: Movements page, mobile view (375×812) — src/app/features/movements, live at /movements
Method: Assessment A only (design review via isolated sub-agent; Playwright inspection, measured bounding boxes). No deterministic scan, no overlay evidence.

## Design Health Score — 24/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Filter selects render blank (no "All categories"); net-flow ignores active filters while the list is empty |
| 2 | Match System / Real World | 2 | Desktop column-header copy ("CATEGORY / ACCOUNTS") pasted above every stacked row; keyboard-speak ("N TRANSACTION · ESC CLOSE") on a touch device |
| 3 | User Control and Freedom | 3 | Undo toast (pause on hover/focus) genuinely good; no swipe actions; scope months data-derived so empty months can't be browsed |
| 4 | Consistency and Standards | 2 | The two capture forms behave differently on mobile: transfer collapses to 1 column, quick-add stays 2-up and overflows |
| 5 | Error Prevention | 3 | Disabled Save + inline reason is excellent; Delete sits immediately beside Edit at 44px adjacency |
| 6 | Recognition Rather Than Recall | 2 | Icons-only bottom nav, blank selects, shortcut legend demanding memorized N/T/Esc |
| 7 | Flexibility and Efficiency | 2 | Zero touch fast-paths: desktop `+ QUICK ADD` vanishes on mobile with no FAB/center-nav replacement |
| 8 | Aesthetic and Minimalist Design | 2 | Stripe/mono discipline strong, but per-row repeated caps labels, 2-line shortcut hint, 220px always-expanded filter card are noise |
| 9 | Error Recovery | 3 | Clear Filters offered twice (badge row + empty state), inline form errors, undo; single error line per form, no field targeting |
| 10 | Help and Documentation | 2 | The only visible help is the shortcut hint — documentation for the wrong input modality |

Cognitive load: 6 of 8 checklist items fail (single focus, chunking, hierarchy at detail level, one-thing-at-a-time for capture, ≤4 options, working memory, progressive disclosure). Landing viewport presents 7 interactive controls before any content; first ledger row starts at y=714 with only a 24px sliver visible.

## Design Specificity Verdict

The Monolith Ledger skin survives the trip to mobile remarkably well — 4px directional stripes migrate to the row edge, JetBrains Mono stays tabular on every figure, caps labels self-label stacked cells, dashed empty state and square blue badge are on-world. This is an authored design, not a Tailwind default. But the ergonomics are category-interchangeable desktop-first: the page is the desktop ledger vertically stacked rather than recomposed for a thumb — ~700px of chrome before the first row, a keyboard-shortcut legend on a touch screen, and a capture form that literally falls off the phone.

Deterministic scan: skipped (Assessment B declined by user). No overlay evidence available.

## What's Working

1. **The net-flow card** — scope-qualified caps label, 24px JetBrains Mono figure, green ↑ IN / red ↓ OUT, grey transfer-stripe edge. Maximum information at minimum ink; the only 24px voice on the page that earns it.
2. **The ≤480px row-stacking** (movements.component.scss) — stripes to the row edge, right-aligned tabular mono amounts, transfer rows keep grey tint, ambiguous cells self-label via `data-label`. The design language bends without breaking.
3. **Consciously engineered mobile details** — 44×44px row icon buttons on coarse pointers (measured), undo toast offset clearing nav + safe area, aria-current/aria-sort/live regions throughout, blue 2px focus.

## Priority Issues

**[P0] Quick-add form overflows horizontally off the phone.** Measured: grid resolves to 211px+250px columns inside a 343px card; Category/Note/Period fields sit at x=260→510 on a 375px viewport; document.scrollWidth = 510. Cause: native `<select>` min-content (widest option, e.g. "Food (Expense)") forces the 1fr/1fr tracks wider than the card; quick-add-card.component.scss collapses only `.exchange-rate-grid` at 768px while movements.component.scss already collapses its own `.form-grid`. The fix exists in the codebase — it just wasn't applied here. Fix: add `grid-template-columns: 1fr` for `.form-grid` at ≤768px in quick-add-card (defensively `minmax(0, 1fr)` + `width: 100%` on fields).

**[P0] Zero ledger above the fold.** Measured y-map: top bar 0–73, header 89–233, net flow 257–372, CTAs 396–429, shortcut hint 437–461, filter card 477–697, first row 714 (24px visible under the nav). A tracking app shows no tracked data on load. Fix: collapse the filter card to a single search row + chips (the exchange-rate well already proves the disclosure pattern), hide the shortcut hint on touch, compact the subtitle to one line.

**[P1] Keyboard shortcut legend leaks to touch** (movements.component.html:61). "SHORTCUTS: N TRANSACTION · T TRANSFER · ESC CLOSE" renders as a 2-line, right-aligned caps block on every phone visit — meaningless on touch, ~48px of prime space. Fix: `@media (pointer: coarse) { .shortcut-hint { display: none; } }`. Fine on desktop where it sits inline right of the CTAs.

**[P1] Primary actions are 33px tall.** Measured: `+ TRANSACTION` 149×33, `+ TRANSFER` 121×33, form CANCEL/SAVE 91×33/71×33 — below the design's own 44px mobile promise (row icon buttons already got the 44px rule; extend it to `%btn-base` under the same media conditions).

**[P1] Filter selects render blank.** CATEGORY and ACCOUNT dropdowns show empty instead of "All categories"/"All accounts" (ngModel `null` matches no `<option [value]="0">`), on mobile and desktop. The bare solid-blue "1" badge is action-blue on a non-actionable count — a color-discipline drift. Fix: default the model to `0`; restyle the badge outline/neutral.

**[P2] No global capture affordance on mobile.** The desktop sidebar's loudest element — solid-blue `+ QUICK ADD` — is `display:none` ≤768px and the bottom nav has only 3 tabs. Fix: a center nav capture action or ledger-language FAB.

**[P2] Scope selectors under-composed.** Not visually broken (40px tall, side-by-side, aligned under the headline) but an unlabeled pair of native dropdowns that reads as stray filters, costs two taps per scope move, and visually duplicates the ACCOUNT filter below.

### Verdicts on the user's three suspicions
1. Scope selectors — partially agree: functional but under-composed; reads as stray filters, duplicates the ACCOUNT filter.
2. Full-width CTAs — disagree: measured 149px/121px, content-sized, side-by-side. The real defects are 33px height and the hint row beneath.
3. SHORTCUTS label — strongly agree (P1 above).

## Persona Red Flags

- **Casey (distracted, one-handed):** quick-add right column unreachable (P0); 0 rows visible on load; Delete trash 44px-adjacent to Edit pencil in every card; 33px CTAs; icons-only nav offers no recognition anchor.
- **Alex (impatient power user):** mobile loses `+ QUICK ADD` and N/T/Esc with no replacement fast-path; capture requires open-form + 7-field scroll; no swipe-to-delete/edit; transfer form's Save sits ~850px below its heading with no sticky bar.
- **Sam (a11y):** SR/keyboard support genuinely strong (aria-labels on every icon button, live regions, table caption, skip link); failures are visual/cognitive — blank selects, icons-only nav, 2-line caps hint as SR noise, 44px convention missed on the most-used buttons.

## Minor Observations

- "CATEGORY / ACCOUNTS" per-row label is desktop-header copy; "CATEGORY" alone (or nothing, given the chip) would do; ACCOUNT label repeats for every "Checking" row.
- Net flow ignores active filters — empty list under a "+ €4,463.57" headline feels like a lie; needs an "unfiltered" cue.
- Movement cards run ~195px tall; ~5.5 rows per two screens — long ledgers become a label parade.
- Month/year dropdowns are data-derived; stable-ordering and browse-empty-month questions apply.
- 2px press shadow on buttons reads well on mobile; `:active` shed is a good touch.
- Foreign-amount display "US$1,250.50 → €1,350.54" fits but is tight; larger rate strings will stress the nowrap cell.

## Questions to Consider

1. If the ledger is the product, why does a phone show zero ledger until the second screenful — does the net-flow card earn its seat above the list, or should the list lead and the summary follow?
2. Should capture be an inline page state on mobile at all — would a bottom sheet (transfer's 1-column pattern + sticky Save + the exchange well) make both forms identical and thumb-native?
3. The desktop sidebar's blue `+ QUICK ADD` is the app's loudest voice; on mobile it disappears entirely. What is the mobile equivalent of "one blue action"?

---
target: movements tab
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-28T20-35-52Z
slug: src-app-features-movements
---
# Design Critique: Movements Tab

Method: dual-agent (A: ses_fb5fe7de6ffetOTkv3AeRfXxk0 � B: ses_fb5fe5ec9ffe21eDdeZXv0sLF4)

Target: src/app/features/movements/ � Mode: Operate � Design system: "The Quiet Register"

## Design Health Score: 26/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Opening edit/transfer forms moves nothing on screen |
| 2 | Match System / Real World | 3 | Date + Period + Year are three decisions for one fact; period/year don't follow date |
| 3 | User Control and Freedom | 3 | 5-second undo window with no pause |
| 4 | Consistency and Standards | 3 | Quick-add defines its own button dialect beside shared %btn-* patterns |
| 5 | Error Prevention | 2 | Transfer form has zero validation |
| 6 | Recognition Rather Than Recall | 3 | User must recall which month a chosen date falls in |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no search, no sort, unbounded "All time" |
| 8 | Aesthetic and Minimalist Design | 3 | On-system; dead SCSS and wide Actions column are residue |
| 9 | Error Recovery | 3 | Transfer save errors surface raw e.message |
| 10 | Help and Documentation | 1 | No contextual help anywhere |

na_heuristics: none (all 10 scored; max 40)

## Design Specificity Verdict

Unmistakably authored for "The Quiet Register": direction arrows at 600 weight, amounts colored only by direction, Mist-Paper transfer rows, ink-tint exchange well, hairline table. Delete confirmation microcopy is ledger-native. One generic island: the controls/filter strip.

Deterministic scan: 2 design-system-color advisories (rgb(0,0,0), line 0) � both FALSE POSITIVES (static cascade default; real ink is var(--body-ink) token). No true positives; detector caught nothing the LLM missed.

Browser: skipped � no browser automation tool exposed in this session; no user-visible overlay available.

## What's Working

1. Destructive confirmation in ledger voice (deleteConfirmationLabel(), movements.component.ts:486) with full snapshot/restore undo.
2. Progressive disclosure: compact 1.5fr 1fr 1fr grid, More options expansion, conditional exchange-rate well.
3. Accessibility plumbing: visually-hidden aria-live announcements, role="status" undo toast, 2px :focus-visible outline, tabular-nums figures.

## Priority Issues

1. [P1] Transfer form has no validation � saveTransfer() (movements.component.ts:406) accepts amount <= 0, empty amounts, destAccountId: 0 (line 328). Fix: canSubmitTransfer computed, disable Save, mirror quick-add disabled styling. Command: /impeccable harden
2. [P1] Income green #16a34a fails WCAG AA (~3.0:1) at 0.9rem/600 in td.income and .arrow-income (movements.component.scss:180-186, 274-276). Fix: darken text use to #15803d. Command: /impeccable audit
3. [P1] No focus management when forms open � editTransaction.set (line 250), openTransferForm (line 261) render far from trigger with no scroll/focus. Fix: scrollIntoView + focus form heading. Command: /impeccable polish
4. [P2] Undo window 5s, no pause (scheduleUndoAutoDismiss, line 546). Fix: 8-10s, pause on hover/focus. Command: /impeccable polish
5. [P2] Empty state ignores filters (lines 310-315) � blames the month when filters excluded everything. Fix: branch on activeFilterCount(), add "Clear filters" inline button. Command: /impeccable clarify

## Persona Red Flags

Alex (power user): unbounded "All time" rows, no search/sort/pagination; no keyboard path to + Transfer; double-Enter opens two edit states; batch delete costs confirm + wait per row.
Sam (a11y): income contrast ~3.0:1; contradictory role="alert" + aria-live="polite"; focus drops to body when Delete is replaced by confirm row; th lacks scope="col"; no table caption; filter-badge reads bare "3".
Riley (stress tester): -50 transfer saved without complaint; date edit out of scope makes row vanish (reads as data loss); one-account profile defaults dest to source (self-transfer); 500-char note explodes row; 2012 date not representable in Year select.

## Minor Observations

- Dead SCSS: .movement-list/.movement-item/.movement-main/.movement-meta/.movement-actions/.tags/.type-label (movements.component.scss:100-151, 234-264); DESIGN.md's neutral type chip documented but not implemented.
- Quick-add .record/.more/.material-btn instead of %btn-primary/%btn-base; .record uses unsanctioned font-weight 600.
- track $index on movements loop (line 221) � use item.data.id.
- role="alert" + aria-live="polite" on same element; pick one.
- DESIGN.md claims no custom tracking, yet --tracking-micro applied � doc drift.

## Questions to Consider

- If Date determines Period and Year, why enter all three?
- Should "All time" group by month with sticky hairline month-rules, like a paper account book?
- Is inline delete-confirm calmer than immediate delete + longer pausable undo?

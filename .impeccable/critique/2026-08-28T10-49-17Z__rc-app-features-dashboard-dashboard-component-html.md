---
target: critique
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-28T10-49-17Z
slug: rc-app-features-dashboard-dashboard-component-html
---
# Design Critique — Open Expenses Dashboard

**Method: dual-agent (A: ses_fb8098b83ffeUExY14VO3SQGgH · B: ses_fb8089f7bffeMxrkXciK96t8bB)**
**Target:** Dashboard surface — default route `/dashboard` (`src/app/features/dashboard/dashboard.component.*`)

**Scope note:** The command was run with no target, so the target resolved to the app's default landing surface (Dashboard). The chrome (shell, backup banner, install prompt) and sibling surfaces (Movements, Settings, Onboarding) were read for consistency grounding.

**Browser note:** No browser automation is available in this environment (no Playwright/Puppeteer, no Chromium/Edge binary), so Assessment B's visual-overlay & screenshot step was skipped with that reason. Both assessments were source-driven.

## Design Health Score

(Mode: Operate — all 10 heuristics applicable.)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | No loading state; figures pop in silently after IndexedDB fetch |
| 2 | Match System / Real World | 3 | Plain money language, but bare year selects ("2026") force inference |
| 3 | User Control and Freedom | 3 | Read-only surface (no undo exposed); fixed 10-year window traps older data |
| 4 | Consistency and Standards | 2 | Three temporal scopes whisper across cards; amber warning = 4th functional color |
| 5 | Error Prevention | 3 | Unlabeled selects invite scope confusion; category totals silently fall back to native amounts |
| 6 | Recognition Rather Than Recall | 2 | "Expenses by Category" missing currency denominator; scope carried in the head |
| 7 | Flexibility and Efficiency | 1 | Peak task (record an expense) unreachable from landing; no shortcut, no quick-add |
| 8 | Aesthetic and Minimalist Design | 3 | Quiet and disciplined, but Total Balance duplicates Account Balances; 5 equal cards |
| 9 | Error Recovery | 3 | Exemplary conversion-failure strip, but no retry affordance |
| 10 | Help and Documentation | 1 | No help, no empty state, no legend anywhere |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

**LLM assessment:** The skin is brand-locked — the ledger system (paper cards, hairlines, one blue ink, green/red reserved for money direction, tabular figures) could not be pasted onto an unrelated product without screaming "finance tool." But the operating model is commodity: read-only cards, bare selects, no drill-through, no record affordance — swap the labels and the composition fits any analytics dashboard. Specificity lives in what the page shows, not what it lets you do: ~6.5/10, and weak exactly where Operate mode is won.

**Deterministic scan:** 7 findings (rule `design-system-color`, all advisory) — all 7 are a single systematic false positive. The detector resolves styles from `<style>`/`<link>` inside each markup file; Angular component templates carry neither, so every text node falls back to the UA initial black (`rgb(0,0,0)`), which never actually renders (global `styles.scss:30` sets Body Ink `#374151`). Net: **0 real findings**. The detector is near-deaf to this project because the visual system lives in component-scoped SCSS, which it never reads — so it also missed real drift it can't see: `shell.component.scss:21` `#111827` hover (outside the spec'd ramp) and the onboarding stray grays DESIGN.md itself documents.

**Visual overlays:** none available — browser injection could not run (no browser automation). No fallback signal was produced.

## Overall Impression

Open Expenses looks like what it is: a well-mannered paper register. The reading experience is genuinely good — calm, scannable, figures-first — and it hangs together as a point of view. But the landing surface is a *printout*, not a place you do anything: no title, no record action, three unlabeled scope controls that split the page across three silently different time models, and one of them (the averages year) flatly contradicts the other. The single biggest opportunity: turn the dashboard from a read-only wall of numbers into the operating surface — a scope-stated answer at the top and every figure a link into movements — and put a record action within one thumb-reach.

## What's Working

1. **The stat blocks** (`dashboard.component.scss:38–61`) — muted micro-tracked label over a 1.25rem/600 tabular figure with green/red as the only accent. The Quiet Register exactly as DESIGN.md intends: the number is the loudest thing on the page.
2. **The conversion-failure strip** (`dashboard.component.html:62–66`) — precise, scoped, one sentence, names exactly which accounts are excluded and why. Perfect money-integrity handling, in a straight face.
3. **The backup banner's heartbeat** (`backup-banner.component.ts:8–19`) — strong action label + relative-time caption, correct degraded offline variant. The one place "manual backup" gets daily-altitude voice.
4. **Tab bar restraint** (`shell.component.scss:24–27`) — active = underline + ink, no pill, no fill. Smallest honest way to show location.

## Priority Issues

1. **[P1] The primary action is absent from the landing surface.**
   - *Why:* Logging an expense — the product's highest-frequency act — is 3 deliberate steps away (tab → Movements → "+ Transaction"). On mobile that's the whole battle; Alex abandons.
   - *Fix:* A persistent "+" quick action in the shell (sticky or header button) or a "Record" on the dashboard; a single-field quick-entry (amount + last-used account/category, confirm-with-Return) would collapse the loop to 2 seconds.
   - *Suggested command:* `/impeccable shape`
2. **[P1] Two year controls that contradict each other.**
   - *Why:* `selectedYear` (html:3) drives Totals/Category while `averagesYear` (html:90) is a separate, independently-defaulted control on the same page. Flipping one visibly leaves the other untouched — the one genuine "the page is lying to me" moment in an otherwise trustworthy product.
   - *Fix:* One year selector; the averages card inherits it or previews its own scope explicitly.
   - *Suggested command:* `/impeccable shape` → `/impeccable distill`
3. **[P2] Unlabeled selects + invisible scopes.**
   - *Why:* Three bare `<select>`s (html:3, :8, :90) with no visual or `aria-label`; a screenreader announces "combo box, 2026"; users can't tell which period "Expenses by Category" covers or that balances are all-time. A working-memory failure and an a11y failure at once.
   - *Fix:* Visible "Year/Month" labels (or aria-labels) plus scope-stated card titles — "Expenses by Category — August 2026" — and a currency denominator on the category card.
   - *Suggested command:* `/impeccable clarify` + `/impeccable harden`
4. **[P2] Currency & color vocabulary leaks.**
   - *Why:* Category sums silently mix currencies when `baseCurrencyAmount` is null (dashboard.component.ts:81); Net/Savings borrow income-green for "≥ 0" derived figures (blue is the information ink per DESIGN.md:108); the amber warning (`scss:86–88`) is a 4th functional color outside the sanctioned set.
   - *Fix:* Denominate the category card, switch derived figures to blue ink, tokenize the warning amber or reuse Ledger Red.
   - *Suggested command:* `/impeccable clarify` → `/impeccable colorize`
5. **[P3] High-stakes safety is a browser `confirm()`.**
   - *Why:* The only delete protection in the product is `confirm('Delete this transaction?')` (movements.component.ts:501) — no amount, no account, one misclick from permanent loss, no undo/trash; account deactivation has no confirmation at all (settings.component.html:75). Cold UA dialog inside a calm register is the emotional valley.
   - *Fix:* Inline destructive confirmations carrying amount + account context, then an undo toast.
   - *Suggested command:* `/impeccable harden`

## Persona Red Flags

**Alex (power user)** — *check the month's net, log the coffee just bought:* no record action on the page, no "+", no keyboard accelerator in the shell (shell.component.html:1–10); must babysit two year selectors; zero drill-through — category rows, balances, totals don't link to filtered Movements; the fixed 10-year window (dashboard.component.ts:35) leaves pre-window data unreadable here.

**Jordan (first-timer)** — *just finished onboarding, wants "where is my money?":* first thing she sees is a bare `2026` dropdown and a wall of cards — no title, no `<h1>`, no guidance; the chrome preloads anxiety (install prompt + "Last backup: Never" stacked above the tabs, shell.component.html:1–2); scope is invisible so she reads "Expenses by Category" as the month while it silently means something her own logic can't confirm.

**Sam (screenreader / keyboard)** — *tab through, announce figures, change the month:* three selects with no accessible names; no `<h1>` landmark; no `aria-live` region so a period change that recomputes every card (dashboard.component.ts:63–147) is never announced — Sam only discovers the shift by re-reading figures; focus treatment falls to an un-defined UA default against a flat ink system; backup banner's `aria-disabled` sits on a `<div>`, which reads to AT as plain text.

## Minor Observations

- The category card disappears on zero-expense periods while other cards persist — the page shape shifts between months; a consistent empty state would be calmer.
- "Total Balance" (:54–67) and "Account Balances" (:69–85) double-present the same sum with no cross-reference.
- Net/Savings reuse income-green for "≥ 0" — a positive derived figure borrows a direction color (covered in P4).
- No save/empty-state confirmation after operating; successful saves are silent.
- Installation prompt + backup banner stack into a "strip mall" density atop an otherwise quiet page.

## Questions to Consider

- If recording is the product's highest-frequency act, why does the landing surface have no record affordance?
- Is the month-name/year reporting model the *user's* model, or does it force a split the interface should reconcile (one scope, everywhere)?
- What if every figure on this page linked into Movements pre-filtered to its own scope, with a single "Spent €412 this month, €98 left" answer at top of fold?
- Should derived figures (Net/Savings) use blue ink so green/red stay semantically airtight: strictly money in / money out?

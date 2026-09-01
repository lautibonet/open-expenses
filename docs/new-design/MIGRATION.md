# UI Migration Plan: Quiet Register → Monolith Ledger

Migrate the existing Angular 21 PWA to the Stitch "LedgerFlow / Rigid Minimalism" visual design
(`docs/new-design/*_ledgerflow/`) **without changing any functionality, business logic, data
models, or user flows**.

**Status:** complete — all phases (0–7) implemented on `feat/new_design`; see
[Phase 7 sign-off](#7-polish--sign-off) for the final pass and deviations.

---

## 0. Ground rules (decided)

| # | Decision |
|---|---|
| D1 | **Screenshots are canonical for layout/look**; `monolith_ledger/DESIGN.md` for tokens (they match). |
| D2 | **Spirit, adapted** — restyle onto the new token system; all current flows preserved as-is. |
| D3 | **Keep the app glossary** (CONTEXT.md): Movements, Quick Add, Stats, Open Expenses. No design-driven renaming. CONTEXT.md unchanged. |
| D4 | **No Accounts page.** Sidebar carries the existing 3 items: Movements, Stats, Settings. |
| D5 | **No Danger Zone / Wipe Data** — new destructive feature, out of scope. |
| D6 | **Quick Add card restyled in place** — same 416-line behavior (rate fetch, confirm/override, localStorage memory). Design's "ADD ENTRY" CTA becomes a Quick Add CTA that scrolls/focuses the card. |
| D7 | **Fonts self-hosted** (woff2 in `public/fonts/`), no Google Fonts CDN — offline-first PWA. |
| D8 | **No green token.** Income = primary blue, expense = error red (matches screenshots' ↑ blue / ↓ red). **Reversed 2026-08-31 (ADR 0011, issue #69):** income is ledger green (`--income` #15803d), transfers get a quiet grey stripe (`--stripe-transfer`), and the Movements Type column (with its ↑/↓/= arrows) is dropped — the 4px edge stripe is the type's only signal. |
| D9 | **Mobile: sidebar collapses to a bottom nav bar** (not the HTML's top-nav hint), with safe-area insets. |
| D10 | **ADR 0008 stands** — tokens stay CSS custom properties in `src/styles.scss`; values replaced. No Tailwind, no new styling architecture. `DESIGN.md` rewritten. |
| D11 | **Token-first rollout**, then screen-by-screen; `ng test` (Vitest) after each phase. |
| D12 | **Net Flow card added** on Movements — new read-only UI, derived data only (scope income − expense in base currency). |
| D13 | **Scope is a single Period** (month + year), dressed in the design's stepper/segmented chrome. No Quarter. All Time removed (issue #81). |
| D14 | Settings stays **inline-save** and **deactivate** (never hard-delete); deactivation uses an ×-style affordance, not destructive remove — updated to a single top-to-bottom card flow with one category per row (type-striped, like the accounts list) and an × → tick/× icon confirmation replacing text buttons (issue #76). No "Save Changes" button. No "Load More Records" pagination. |
| D15 | **Icons: hand-rolled inline SVGs**, not Material Symbols. The needed set is tiny (chevrons, ↑/↓, pencil, ×, +); the Material Symbols variable woff2 is ~3.5 MB — prohibitive to precache offline for glyphs we would never use — and subsetting it adds tooling and binary-asset upkeep for no gain. Inline SVGs inherit `currentColor`, scale crisply, need no network request, and keep the zero-CDN stance. |

Derived implications:
- Warnings (conversion failure, backup errors) adopt the **error ramp** — the design palette has no amber.
- `theme-color` meta and manifest `theme_color` → `#003ec7`.
- Sidebar status label ("LOCAL STORAGE ACTIVE" in the design) becomes a localized status chip ("Local storage" / ES "Almacenamiento local") — descriptive only, no glossary conflict.

---

## 1. Design tokens

Single source of truth remains `src/styles.scss` `:root` (ADR 0008). Replace the Quiet Register
ramp with the LedgerFlow ramp. Suggested token names keep the existing naming *style*
(functional names), values from the extracted Stitch palette:

### 1.1 Color mapping (current → new)

| Current token | Value | New token | Value | Notes |
|---|---|---|---|---|
| `--paper-white` | `#ffffff` | `--surface-lowest` | `#ffffff` | cards, inputs |
| `--mist-paper` | `#f9fafb` | `--background` | `#f9f9f9` | app background |
| `--silvered-paper` | `#f3f4f6` | `--surface-container-low` | `#f3f3f3` | + `--surface-container` `#eeeeee`, `--surface-container-high` `#e8e8e8`, `--surface-container-highest` `#e2e2e2`, `--surface-dim` `#dadada` |
| `--hairline-graphite` | `#e5e7eb` | `--outline-variant` | `#c3c5d9` | subtle dividers only |
| `--edge-graphite` | `#d1d5db` | `--outline` | `#737688` | secondary strokes |
| `--body-ink` | `#374151` | `--on-surface` | `#1a1c1c` | primary ink; doubles as **border black** |
| `--muted-slate` | `#6b7280` | `--on-surface-variant` | `#434656` | secondary text |
| `--faint-ash` | `#9ca3af` | `--outline` | `#737688` | merged |
| `--ledger-ink` | `#2563eb` | `--primary` | `#003ec7` | active nav, links |
| `--ledger-ink-bright` | `#3b82f6` | `--primary-container` | `#0052ff` | big CTA fill |
| `--ink-well-blue` | `#1e40af` | `--primary-deep` | `#0038b6` | hover/pressed |
| `--ink-tint` / `-hover` / `-edge` | `#eff6ff`/`#dbeafe`/`#bfdbfe` | `--primary-fixed` | `#dde1ff` (+ `--on-primary-fixed` `#001452`, `--on-primary-container` `#dfe3ff`) | selected tiles, tinted surfaces |
| `--ledger-green` | `#15803d` | `--income` | `#15803d` | **revived** (D8 reversed, ADR 0011) — income figures and the income stripe |
| `--officers-red` | `#dc2626` | `--error` | `#ba1a1a` | expense, destructive |
| `--danger-surface/border/edge/ink/text` | amber-free red ramp | `--error-container` `#ffdad6`, `--on-error-container` `#93000a` | | negative balances, warnings (see implications) |
| `--amber-surface/border/ink` | `#fef3c7`… | — **retired** | — | warnings use error ramp |

New structural tokens:

| Token | Value | Purpose |
|---|---|---|
| `--border-hard` | `1px solid var(--on-surface)` | default card/control stroke |
| `--border-hard-thick` | `2px solid var(--on-surface)` | modals, emphasis |
| `--stripe-income` | `4px solid var(--income)` | row/card left edge, income (D8 reversed: was `var(--primary-container)`) |
| `--stripe-expense` | `4px solid var(--error)` | row/card left edge, expense |
| `--stripe-transfer` | `4px solid var(--outline)` | row left edge, transfers (D8 reversed) |
| `--row-hover` | `#f5f5f5` | table/list hover |
| `--grid-line` / `--grid-size` | `#e2e2e2` / `40px` | onboarding graph paper |
| `--shadow-press` | `2px 2px 0 0 var(--on-surface)` | the **only** shadow; removed on `:active` (button press) |

### 1.2 Typography

Fonts: **Inter** (UI) + **JetBrains Mono** (all monetary/numeric data), self-hosted (D7),
`@font-face` in `styles.scss`, `font-display: swap`, fallback `system-ui` / `ui-monospace`.

| Token | Spec | Replaces |
|---|---|---|
| `--type-display` | 48px / 1.1 / 800 / −0.02em | — (page headlines; mobile: 24px) |
| `--type-headline` | 32px / 1.2 / 700 / −0.01em (mobile 24px) | `1.1rem` headline |
| `--type-title` | 20px / 1.4 / 600 | `1rem` |
| `--type-body-lg` | 18px / 1.6 / 400 | — |
| `--type-body` | 16px / 1.5 / 400 | `0.9rem` |
| `--type-caption` | 14px / 1.4 / 400 | `0.85rem` |
| `--type-label` | 12px / 1.0 / 700 / +0.1em, uppercase | `0.8rem` labels |
| `--type-data` | 14px / 1.4 / 500, JetBrains Mono, `font-variant-numeric: tabular-nums` | — |

> The ramp is a sizeable bump (body 0.9rem → 1rem, headlines ~3×). Density-sensitive spots
> (Quick Add, tables) must be checked per screen — see Risks.

### 1.3 Spacing, radius, elevation

- Spacing on the 4px grid: `--space-xs: 4px`, `--space-sm: 8px`, `--space-md: 16px`,
  `--space-lg: 24px`, `--space-xl: 40px` (only change: xl 32→40).
- **Radius: everything 0.** `--radius-sm/md/lg/pill` → `0` (keep the token names so existing
  SCSS keeps compiling; chips/pills go square, per design).
- `--shadow-float` retired → `--shadow-press` (§1.1).

### 1.4 Responsive behavior

| Regime | Width | Layout |
|---|---|---|
| Desktop | ≥ 769px | Fixed left sidebar (256px, 1px black right border) + fluid main area, 24px gutters, content max-width ~1200px |
| Mobile | ≤ 768px | Top bar (brand + status) + **bottom nav bar** (D9), content full-width, 16px gutters, bottom safe-area padding (`env(safe-area-inset-bottom)`) |

Breakpoint moves 560px → 768px (sidebar needs ~700px+). Display/headline sizes step down at
the mobile regime (`headline-lg` 32→24, `display` 48→24).

---

## 2. Layout & navigation changes

**Shell (`src/app/shared/components/shell/`)** — restructured, same routes and `<router-outlet>`:

- **Desktop sidebar** (new markup in shell):
  - Brand block: black square monogram "O" + "Open Expenses" (D3 — no "LedgerFlow").
  - Status chip: localized "Local storage" caps label (new translation keys).
  - Vertical nav, 3 items (D4): Movements, Stats, Settings. Active state = solid `--primary`
    block with white text (replaces blue-underline tabs).
  - Bottom: **"+ Quick Add"** button (solid `--primary`, `--shadow-press`, D6 — focuses the
    Quick Add card on Movements; hidden/no-op there) and a **Backup** link → `/settings`
    (backup card), replacing the design's "New Entry"/"Backup" pair.
  - Keep skip-link, `aria-current`, nav `aria-label` semantics — tests depend on them.
- **Mobile**: top bar (brand + status chip) + bottom nav bar, same 3 items + active-solid-blue
  state; add bottom padding so content never hides behind the bar.
- **Strips** (`backup-banner`, `install-prompt`): restyled as bordered caps-label strips
  (offline/disabled/error states keep their current logic and `role="alert"`).
- **Onboarding** keeps rendering standalone (no shell), 600px column, graph-paper grid
  background.

---

## 3. Screen-by-screen redesign

### 3.1 Movements (`features/movements/`)
- Page headline treatment: display type "Movements" + subtitle; period control top-right.
- **Scope control (D13)**: single Period — month/year selects only, All Time removed
  (issue #81). `aria-label`s preserved (tests: `select[aria-label]`, `[aria-label="Ámbito: año"]`).
- **Net Flow card (D12, new)**: bordered card, 4px left stripe, mono numerals: net = scope
  income − expense in base currency; small IN/OUT sub-lines in green/red (D8 reversed); a
  negative net swaps the stripe to the expense red. Derived
  from existing scope queries — no new service logic.
- Movements list → bordered data table look: 4px left stripes per row direction (green income /
  red expense / grey transfer — D8 reversed), category chip tags (square), mono right-aligned
  amounts, `#f5f5f5` row hover. Keep the existing `<table>` markup,
  `.tag`/`.note`/`.undo-toast`/`.rate-source` classes (tests hook them), sort `aria-sort`,
  inline editing. No Type column or direction arrows (D8 reversed): the stripe is the only type
  signal.
- Quick Add card: same form, fields restyled (square, 1px black border, 2px blue focus,
  caps labels); exchange-rate well and readonly computed field restyled, behavior untouched.
- Transfer editor + delete/undo toast: restyled only; 10s undo logic untouched.

### 3.2 Stats / dashboard (`features/dashboard/`)
- Headline "Stats" (keep glossary; tests assert the h1) + existing scope selects (month/year —
  **no Quarter**, no All Time, D13).
- Totals → 3 KPI cards with 4px left stripes: Avg Income (green, D8 reversed), Avg Expense (red), and a
  solid-ink inverted "Net Average / savings-rate" card. Maps current per-category/per-account
  data; conversions keep current failure-warning behavior (error-ramp strip, D8 implication).
- "Expenses by Category" → CSS horizontal bars (no chart lib; black/gray fills).
- "Account Balances" → bordered list; negative balances on `--error-container` tiles.

### 3.3 Settings (`features/settings/`)
- Single top-to-bottom card flow (updated in issue #76, superseding the bento
  grid): Base Currency + Language side by side in the top row, then Accounts,
  Categories, Backup (D5: no Danger Zone).
- Accounts: rows with click-to-edit name/opening balance (no pencil icon),
  × → tick/× icon deactivation confirmation with no message text (same pattern
  as movement deletion), textual Reactivate on inactive rows, dashed
  "+ Add Account".
- Categories: one per row, styled like the accounts list, green/red edge stripe
  by type; × → tick/× deactivation confirmation replaces the immediate chip ×;
  textual Reactivate on inactive rows; dashed "+ Add".
- Add forms: name input, currency/type select and Add button share uniform
  field heights/widths, matching the app's field/button patterns.
- Base currency / language: native selects restyled square with caps labels (logic unchanged).
- `backup-card` / `language-card`: restyled; Drive connect/backup/restore states, offline
  disable, and error strips unchanged.

### 3.4 Onboarding (`features/onboarding/`)
- Graph-paper `--grid-line/40px` background; top bar "OPEN EXPENSES" / "SETUP" caps labels.
- 5-step tab bar matching the wizard's existing steps (language → restore → currency →
  accounts → categories) with check marks for completed steps; pure restyle of step state.
- Currency step: bordered square tiles (selected = 2px blue border) + "search other
  currencies" input; same currency list source (`core/constants/currencies.ts`).
- Footer: "← Back" (bordered) / "Continue →" (solid blue + `--shadow-press` press effect).
- Steps 1, 2, 4, 5 have no screenshots — extend the language (borders, caps labels, tiles)
  consistently; logic (restore-overwrites-language, defaults, completion) untouched.

---

## 4. Component inventory

**Create**
| Unit | Location | Notes |
|---|---|---|
| Net Flow card | `features/movements/net-flow-card/` | D12; inputs: scope movements + base currency |
| Sidebar nav (desktop) + top bar & bottom nav (mobile) | inside `shell.component` (or `shared/components/nav/`) | D4, D9 |
| Status chip | part of shell | localized label |

**Modify (restyle only unless noted)**
| Unit | Change |
|---|---|
| `src/styles.scss` | token replacement (§1), `@font-face`, base element styles (square controls, focus rings) |
| `shared/styles/_patterns.scss` | restyle all placeholders: `%btn-*` (solid fills, press shadow), `%field`, `%readonly-field`, `%stacked-label` (caps), `%exchange-well`, `%rate-*`; add hard-border/stripes/mono-data helpers |
| `shell.component` (html/scss) | sidebar/bottom-nav layout (§2) |
| `backup-banner`, `install-prompt` | strip restyle; markup hooks (`app-backup-banner`, `.backup-banner`, `.backup-action`) preserved for tests |
| `movements.component` (+html/scss) | §3.1; table/chips/stripes/scope chrome; keep `.tag`, `.note`, `.undo-toast`, `.rate-source`, `aria-sort`, live regions |
| `quick-add-card.component` | field restyle; `TransactionFormPayload` and logic untouched |
| `dashboard.component` | §3.2; keep `.stat .value.information` hooks or update tests in step |
| `settings.component`, `backup-card`, `language-card` | §3.3 |
| `onboarding.component` | §3.4 |
| `index.html` | `theme-color` → `#003ec7`, font preloads |
| `public/manifest.webmanifest` | `theme_color`/`background_color` |
| `public/sw.js` | add `/fonts/*.woff2` to `PRECACHE_URLS`; **bump `CACHE_NAME`** |
| `core/translations/translations.ts` | new keys: Net Flow, status-chip label, Quick Add CTA, step labels (EN/ES) |
| `DESIGN.md` | rewrite for Monolith Ledger (front-matter token table format kept) |

**Unchanged**
- All `core/` services, models, Dexie schema/migrations, `backup/` providers, format utils,
  types/constants; `app.routes.ts`; `app.ts` redirect logic; PWA install/network service
  logic; all form payloads, validation, undo/restore, localStorage keys; i18n mechanism.
- CONTEXT.md — glossary stands (D3).

---

## 5. Assets

| Asset | Source | Home |
|---|---|---|
| Inter — variable woff2, latin subset, declared `400 800` (covers the 400/600/700/800 ramp; Google Fonts serves the same variable file for every requested weight, so one 47 KB file replaces four static ones) | Google Fonts (OFL, license in folder), self-hosted (D7) | `public/fonts/inter-variable-latin.woff2` |
| JetBrains Mono woff2 — 500 (static instance), latin subset | Google Fonts (OFL, license in folder), self-hosted | `public/fonts/jetbrains-mono-500-latin.woff2` |
| Icons (chevrons, arrows, pencil, ×, +) | **decided (D15): hand-rolled inline SVGs** in component templates — not a self-hosted Material Symbols font | inline |
| Favicon/app icons | existing set unchanged; recolor only if manifest requires | `public/icons/` |

Fonts ship with `font-display: swap`, system fallback stacks (`--font-ui` / `--font-data` in
`styles.scss`), `<link rel="preload">` for both files in `index.html` (the only fonts used at
first paint), and entries in `sw.js` `PRECACHE_URLS` with the cache name bumped.

---

## 6. Risks

1. **Density shock from the type ramp** (body 0.9→1rem, headlines 3×): Quick Add, movement
   rows, and Settings cards may overflow/wrap. Mitigate: verify per screen at 320px and 768px.
2. **Test brittleness**: specs query class names (`.tab`, `.undo-toast`, `.tag`, `.rate-source`,
   `.backup-banner`, `.stat .value.information`, `a.tab`, `nav.tab-bar`). Keep these hooks or
   update the specs in the same commit — never delete assertions to go green.
3. **Service worker staleness**: new font URLs must be in `PRECACHE_URLS` and `CACHE_NAME`
   bumped, or installed PWAs never fetch the fonts offline.
4. **Radius-pill removal** (`--radius-pill: 0`) may deform any element assuming roundness —
   grep usages before flipping to 0.
5. **Warning visibility**: amber→error remap must keep conversion-failure and backup-error
   states clearly distinguishable from plain content (tested states exist — keep them green).
6. **Scope-creep pressure** from the design's extra features (Accounts page, Wipe Data,
   pagination, Quarter, Save button): explicitly out of scope (D4, D5, D13, D14).
7. **Income-in-blue ambiguity**: ~~blue now means both "primary/interactive" and "income".~~
   Resolved by the D8 reversal (ADR 0011, issue #69): income reads green and transfers carry a
   grey stripe, so blue is unambiguously action/information again.
8. **Mobile bottom-nav overlap** with the undo toast and install/backup strips — verify
   stacking and safe-area insets.
9. **FOUT/flash** on first paint — use `font-display: swap` + preloads; fallback stacks tuned
   so metrics jump is small.

---

## 7. Recommended implementation order

Each phase: implement → `ng test` green → quick manual smoke of the affected flows.

| Phase | Content |
|---|---|
| **0. Baseline** | Branch; run `ng test`; note current screenshots for comparison. |
| **1. Foundations** | Fonts into `public/fonts/` + `@font-face`; sw.js precache + cache bump; icon decision; token replacement in `styles.scss` (§1); retire green/amber; `_patterns.scss` restyle; `theme-color`/manifest; rewrite `DESIGN.md`. App is structurally old but fully re-skinned. |
| **2. Shell & navigation** | Sidebar (desktop), top bar + bottom nav (mobile), strips restyle, Quick Add CTA wiring. Verify skip-link/aria hooks. |
| **3. Onboarding** | Grid background, step bar, currency tiles, footer buttons. Smoke: full fresh-profile onboarding. |
| **4. Movements** | Scope chrome, Net Flow card (new component), table/stripes/chips, Quick Add restyle, transfer editor, undo toast. Smoke: add, edit inline, transfer, delete+undo, offline rate failure. |
| **5. Stats** | KPI cards, bars, balances, warning remap. Smoke: conversion-failure path. |
| **6. Settings** | Cards, chips/deactivate, selects, backup & language cards. Smoke: backup/restore, offline disable. |
| **7. Polish & sign-off** | Empty/loading/error states in the new language; focus-visible pass; mobile pass at 320/768px; full `ng test`; end-to-end manual regression (onboard → quick add → transfer → filter → stats → settings → backup → restore). |

### 7. Polish & sign-off — outcome

Automated portion complete; deviations from the plan recorded below. No functionality,
markup hooks, or translation keys changed anywhere in this phase — classes kept
(`.empty`, `.empty-state`, `.rate-status`, `.rate-error`, `.info`, `.success`, `.error`,
`.backup-banner-error`, `.conversion-warning`), so specs stayed green untouched.

**Empty/loading/error state treatments (now uniform):**
- Empty states (Movements table, Quick Add no-accounts/no-categories) use a shared
  `%empty-state` placeholder: dashed 1px `--outline` border on `--surface-lowest`, centered
  `--on-surface-variant` text — the same dashed language as the "+ Add" affordances (§3.3).
- Page/card-level alerts keep the tinted-strip treatment on their sanctioned ramps
  (`%status-strip` — now deduplicated into `%status-strip-primary`/`%status-strip-error` —
  in Settings, Language card, Backup card, backup banner error; the Dashboard conversion
  warning is hand-rolled to the same error-container recipe because it also carries the
  caps-label type). Backup card's transient
  "Working…" (`.info`) and success (`.success`) notes were promoted from bare blue text to
  the primary-tint strip used by Settings, removing the last inconsistency.
- Inline form-level notes stay text-only by design (no strips inside forms): rate
  fetch/status and inline errors (`--error` ink, caption/label ramp); Onboarding's
  `.info`/`.error` normalized to the caption size.

**Focus-visible pass:**
- Single global rule (`styles.scss`): `:focus-visible` = 2px solid `--primary`, offset 2px;
  square corners match the design. Removed the one redundant local duplicate (Movements
  `.th-sort`). Keyboard navigation unchanged (skip link, `aria-current`, live regions).
- The skip-link target (`main[tabindex="-1"]`) intentionally suppresses the outline on the
  whole content column (`:focus`, programmatic focus) — documented in place.

**Mobile pass (320px / 768px):**
- Added a `--nav-bar-size: 4rem` token (recorded in `DESIGN.md` Layout); the bottom nav,
  mobile top bar, main-area bottom padding, and the undo-toast's clearance offset all derive
  from it (previously the toast
  hardcoded 64px while the shell used an SCSS variable).
- `.main-area` now uses `100dvh` (with a `100vh` fallback) so mobile browser chrome doesn't
  strand content behind the bottom nav.
- Overlap audit: strips are in-flow (no fixed positioning), bottom nav z-30 < top bar z-40 <
  skip link z-50 < undo toast z-60, and the toast offsets by nav height + safe-area inset;
  safe-area insets respected on the nav bar, main area, and toast. Form grids, filter bar,
  and step tabs collapse/stack at the 768px regime. The movements table scrolled horizontally
  at 320px; it now stacks into one-thumb row cards below 480px instead (issue #97), with the
  directional stripe moved to the row edge and 44px row-action touch targets on coarse
  pointers.

**Deviations from the plan:** none functional. The additions above (`%empty-state`
dashed treatment, `--nav-bar-size` token, `dvh` viewport height, and the Quick Add compact
form's rate/status notes spanning the full grid row instead of landing in one cell) are
polish-level extensions of the documented design language, not changes to any flow.

**Remaining for human sign-off:** the manual end-to-end regression pass (onboard → quick add
→ transfer → filter → stats → settings → backup → restore, including offline rate failure and
backup error paths) — the automated suite (552 tests) covers the logic and rendered state
text, but a visual click-through on real hardware (including iOS safe areas) is not
agent-verifiable.

---

*Canonical references: screenshots in `docs/new-design/*_ledgerflow/screen.png`, token spec in
`docs/new-design/monolith_ledger/DESIGN.md`, current system in root `DESIGN.md`, vocabulary in
`CONTEXT.md`, token-placement rule in `docs/adr/0008-design-tokens-in-styles-scss.md`.*

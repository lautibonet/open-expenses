---
name: Open Expenses
description: A monolithic, ledger-brutalist personal expense tracker.
colors:
  primary: "#003ec7"
  primary-container: "#0052ff"
  primary-deep: "#0038b6"
  primary-fixed: "#dde1ff"
  on-primary-fixed: "#001452"
  on-primary-container: "#dfe3ff"
  income: "#15803d"
  expense: "#ba1a1a"
  error: "#ba1a1a"
  error-container: "#ffdad6"
  on-error-container: "#93000a"
  surface: "#f9f9f9"
  surface-lowest: "#ffffff"
  surface-container-low: "#f3f3f3"
  surface-container: "#eeeeee"
  surface-container-high: "#e8e8e8"
  surface-container-highest: "#e2e2e2"
  surface-dim: "#dadada"
  outline: "#737688"
  outline-variant: "#c3c5d9"
  border: "#1a1c1c"
  text: "#1a1c1c"
  text-muted: "#434656"
  row-hover: "#f5f5f5"
typography:
  display:
    fontSize: "3rem"
    fontWeight: 800
  headline:
    fontSize: "2rem"
    fontWeight: 700
  title:
    fontSize: "1.25rem"
    fontWeight: 600
  body:
    fontSize: "1rem"
    fontWeight: 400
  body-caption:
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.1em"
    textTransform: "uppercase"
  data:
    fontFamily: "JetBrains Mono"
    fontSize: "0.875rem"
    fontWeight: 500
rounded:
  tag: "0"
  sm: "0"
  md: "0"
  lg: "0"
  pill: "0"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
components:
  button:
    backgroundColor: "{colors.surface-lowest}"
    textColor: "{colors.text}"
    border: "1px solid {colors.border}"
    shadow: "2px 2px 0 0 {colors.border}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  button-primary:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.surface-lowest}"
    border: "1px solid {colors.border}"
    shadow: "2px 2px 0 0 {colors.border}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.surface-lowest}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  button-small:
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  card:
    backgroundColor: "{colors.surface-lowest}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  card-subtle:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  input:
    backgroundColor: "{colors.surface-lowest}"
    textColor: "{colors.text}"
    border: "1px solid {colors.border}"
    rounded: "{rounded.sm}"
    padding: "0.5rem"
---

# Design System: Open Expenses

## Overview

**Creative North Star: "Monolith Ledger"** (ADR 0010; migration plan in `docs/new-design/MIGRATION.md`)

Open Expenses is a slab of financial architecture: rigid minimalism and modern flat design applied to a personal expense tracker. Every screen is a block of machined surfaces — stark whites on a near-black grid of 1px strokes, sharp 90-degree corners, one saturated Digital Blue reserved for action, and ledger green reserved for income. Depth is communicated through color blocking and stroke weight, never shadows or gradients; the interface reads as controlled authority and absolute transparency.

Type is the loudest tool: an Inter ramp stepped way up (48px display, 32px headlines) so headlines dominate, uppercase letter-spaced caps labels for all metadata, and JetBrains Mono tabular figures for every number so columns of amounts align as one ledger. Nothing decorative earns space unless it helps record or read a number correctly.

**Key Characteristics:**
- Zero-radius geometry: every element is square (radius `0` on controls, wells, cards, chips, and pills)
- Hard 1px black borders on cards and controls; tonal gray steps only zone, never separate
- Flat hierarchy: the single sanctioned shadow is the 2px press shadow on buttons, removed on `:active`
- High-contrast utility: near-black ink, stark whites, saturated functional blues, one urgent red, and one ledger green
- Inter for interface, JetBrains Mono (tabular) for all monetary/numeric data, both self-hosted

## Colors

A neutral monochrome ramp frames the data; blue acts, red is money out and everything that warns, and green is money in (D8 reversed, ADR 0011). There is no amber: warnings adopt the error ramp.

### Primary
- **Primary** (#003ec7): the system's action ink — active nav, links, and the browser theme color (`<meta theme-color>` is #003ec7).
- **Primary Container** (#0052ff): the vibrant "Digital Blue" fill for big call-to-action buttons; hovers deepen to **Primary Deep** (#0038b6).
- **Primary Fixed** (#dde1ff): the blue wash for tinted wells and informational surfaces (exchange-rate capture), with **On Primary Fixed** (#001452) as its ink.

### Neutral

The surface family. One ramp, seven steps, everywhere: **Surface Lowest** (#ffffff) for cards and inputs, **Background** (#f9f9f9) for the app background and raised form wells, **Surface Container Low** (#f3f3f3) through **Surface Dim** (#dadada) for tonal zoning, tags, and wells. Borders are near-black: **Border Hard** (`1px solid #1a1c1c`) is the default card/control stroke, doubled to 2px for modals and emphasis.

Text runs on a two-step ink ramp: **On Surface** (#1a1c1c) for primary ink and labels, **On Surface Variant** (#434656) for captions, table headers, empty states, and secondary text. **Outline Variant** (#c3c5d9) is reserved for subtle dividers only (row rules, chrome strip hairlines); **Outline** (#737688) for secondary strokes.

### Error

The single sanctioned signal family — money out, destructive intent, and every warning (there is no amber).

- **Error** (#ba1a1a): expense figures, destructive buttons, and error text.
- **Error Container** (#ffdad6): the tinted fill of warning strips and destructive-confirmation wells.
- **On Error Container** (#93000a): the ink on the tinted fill and its hairline.

### Income

- **Income** (#15803d): the ledger green revived (D8 reversed) — income figures (movement amount cells, the Net Flow IN line) and the income directional stripe. Green means money in and nothing else: it never marks action, warning, or information. Transfers stay neutral: neutral ink amounts, quiet grey stripe. The Net Flow card's edge stripe is that grey stripe too: its Net is a derived figure — information, not money moving — so a green-flagged negative Net would break the Negative-Stays-Ink Rule below.

### Name Rules

**The Blue Acts Rule.** Blue appears only on action, active state, and information. Blue on a screen means "here is something live or something you can do." Blue never warns, never destroys — that is Error's job — and no longer colors income: money in is green.

**The Ledger Green Rule (D8 reversed, ADR 0011).** Income is green (#15803d), expense is Error red, transfers are neutral with a quiet grey stripe. Direction is carried by color *plus* the 4px directional stripes — green, red, grey — which are the movement type's only signal (the Type column was dropped, arrows with it). Green never touches interactive elements; blue never marks money direction.

**The Negative-Stays-Ink Rule.** A sign never flips a color: negative figures render in On Surface ink, whatever the page. Derived figures — the Movements Net Flow net, the Stats Net and Avg Monthly Savings, the year-spine months — are information, not money moving, so they stay ink at every sign; a minus is a fact, not an alarm. Red marks movement direction (expense figures and expense stripes) and warnings only (error strips, destructive confirmations, an overdrawn account balance); green marks money in; grey carries no direction (ADR 0011).

**The Hard Stroke Rule.** Cards and interactive controls are drawn with 1px solid On Surface; hairlines between rows and strips use Outline Variant. Tinted fills are limited to the primary-fixed wash and the error container — never as gratuitous cards.

## Typography

**Display Font:** Inter (variable, self-hosted woff2, weights 400–800, `font-display: swap`).
**Data Font:** JetBrains Mono (self-hosted woff2, weight 500, tabular figures).

**Character:** Type-as-UI. Inter provides a neutral, highly readable canvas; JetBrains Mono is introduced for numerical data and transaction strings to emphasize the ledger nature of the product. Hierarchy comes from a sizeable, high-contrast ramp — tight line-heights on headlines create dense, impactful blocks — plus uppercase letter-spaced caps for metadata labels. All currency values use tabular monospaced figures so columns align perfectly.

### Hierarchy
- **Display** (800, 3rem; mobile 1.5rem): page-level headlines.
- **Headline** (700, 2rem; mobile 1.5rem): card titles.
- **Title** (600, 1.25rem): onboarding heading and page-level `h1`.
- **Body** (400, 1rem): buttons, inputs, selects, and general content.
- **Body Caption** (400, 0.875rem): secondary explanation, backup timestamps, error messages.
- **Label / Caps** (700, 0.75rem, +0.1em, uppercase): form field labels, table headers, buttons, tags, tiny helper text.
- **Data** (JetBrains Mono, 500, 0.875rem, tabular): every monetary figure and numeric input.

### Name Rules

**The Caps-Label Rule.** Metadata is never whispered in mixed case: labels, table headers, buttons, and tags render in 12px bold uppercase with +0.1em tracking. Fields and inputs inside a caps label reset to Body.

**The Numbers-Are-Mono Rule.** Every monetary amount, rate, and numeric input renders in JetBrains Mono with `font-variant-numeric: tabular-nums`. Interface prose never does.

## Layout

A single centered column, `max-width: 800px` (`main.content` in the shell), padded 1rem on each side, `margin: 0 auto`. The onboarding flow narrows to 600px. The chrome strips above the content — install prompt, backup banner, error strip, and the tab bar — span full width edge-to-edge, but their inner content aligns to the centered content column via the shared chrome gutter (`--chrome-gutter`); only the tab bar is sticky.

Cards stack vertically with 1.5rem (24px) gutter — the `--space-lg` section rhythm every stacked card and section shares, including the Stats KPI cards' stacked row gap (#111). Forms lay out on a two-column grid; the Quick Add card's compact mode gives the amount column the widest track. Tables are full-width, `border-collapse: collapse`, with 0.5rem cell padding, 1px tonal row rules, and a `--row-hover` (#f5f5f5) hover.

Spacing rhythm sits on the 4px baseline grid: 0.5rem (button clusters, table cells), 1rem (form-grid gutters, card padding, page padding), 1.5rem (section spacing), 2.5rem (large group gaps). The responsive breakpoint is 768px; below it, display/headline sizes step down (3rem/2rem → 1.5rem) and grids collapse to one column. In the mobile regime the sidebar becomes a fixed bottom nav bar and a sticky top bar, both sized by the shared `--nav-bar-size` (3.5rem) token with `env(safe-area-inset-bottom)` respected; the main area's bottom padding and fixed overlays (the undo toast) offset from the same token so nothing hides behind the bar; both capture forms present in a bottom sheet above the bar instead of revealing inline (#103, #104, see Signature Components). Below 480px the Movement ledger groups into day sections: a caps-label divider announces each day (chronological order preserved; the dividers never render on desktop, where the Date column carries this), and within a section each row becomes a one-thumb card — the row's own date cell drops out because the divider carries the date, and the per-row DATE/AMOUNT/CATEGORY/ACCOUNTS caps `data-label`s become visually hidden while still announced to screen readers via the existing data-label mechanism. Amounts render at 1rem JetBrains Mono, direction-colored as on desktop; the category chip and account share one muted line with the 44px row actions aligned right; the 4px directional stripe moves to the row edge. The card compresses from ~195px toward ~120px so Edit/Delete never sit behind horizontal scroll on a 375px phone. Both capture forms join the collapse: the Quick Add field grid drops to one column at the same breakpoint (its tracks are `minmax(0, 1fr)` at every width, so a long selected category or note can never push a field past the viewport edge). Pointer modality gates the keyboard documentation: the SHORTCUTS legend beside the capture triggers renders on fine pointers only and is dismissed by `(pointer: coarse)` — keyboard hints are noise on a touch screen. The Movements page clears the fold on a 375px phone (#102): the page subtitle clamps to a single line, the Scope month/year selects sit under one caps label as a single labeled control pair, and the filter card collapses to a single search row so the first movement row renders in the initial viewport.

## Elevation & Depth

The system intentionally rejects physical depth. Depth is color blocking and stroke weight — there are no drop shadows at rest, no gradients, no glass.

### Shadow Vocabulary
- **Press** (`box-shadow: 2px 2px 0 0 var(--on-surface)`): the only sanctioned shadow. Buttons carry it at rest and shed it on `:active`, translating 2px down-right — tactile feedback without elevation.

### Name Rules

**The Press-Don't-Lift Rule.** Interactive elements press into the page; they never lift off it. Anything without a press interaction has no shadow, ever.

## Shapes

Corners are **zero everywhere**: buttons, inputs, cards, modals, chips, and the filter badge all square. The radius token names remain (`--radius-sm` … `--radius-pill`) but all resolve to `0`, so no rule can reintroduce rounding. Dividers are 1px or 2px solid lines — no hairline tricks below 1px.

## Components

### Buttons
- **Shape:** square, 1px hard black border, caps-label text (12px/700/uppercase), `cursor: pointer`, press shadow at rest.
- **Default / Secondary:** Surface Lowest fill, On Surface text. Press sheds the shadow and shifts 2px down-right.
- **Primary:** Primary Container (#0052ff) fill, white text, hard black border; hover deepens to Primary Deep. Reserved for the single prominent action on a form or view.
- **Danger:** two sanctioned treatments — **filled** Error with white text for panel/card-level destructive confirmations (restore), and **outline** Error text and border for anything inside a table row or dense list.
- **Small:** reduced padding (0.25rem 0.5rem); same caps type.
- **Icon-only:** row actions that need no text render as small square icon buttons (pencil Edit, trash Delete, tick/X delete confirm/cancel) — inline SVG at `1rem`, `currentColor` stroke, no visible label; the accessible name comes from `aria-label` mirrored to `title`. Confirm/cancel swaps the whole action pair and announces the deleted-movement prompt through a visually-hidden polite live region, never visible message text.
- **Touch:** on coarse-pointer viewports (and below 480px) every primary control rises to the 44px thumb minimum — the icon-only row actions as 44px squares, and the text-bearing capture triggers (New Transaction / New Transfer) and capture-form Cancel/Save as a 44px `min-height`. Desktop keeps its compact sizing; the press interaction (shadow shed on `:active`) is untouched by the resize.
- **Disabled:** 0.6 opacity, default cursor, no press.

### Cards / Containers
- **Card:** Surface Lowest, 1px hard black border, 1rem padding. The universal unit of Stats and Settings content. Card headers separate from the body by spacing alone — no internal divider rule (dropped deliberately: internal rules are reserved for data structure, i.e. table rows).
- **Form Card:** Background fill (#f9f9f9), 1px hard black border, 1rem padding. The raised well for transaction/transfer editors.
- **Tinted Well:** Primary Fixed fill with a 1px Primary border (exchange-rate capture); headers inside are caps labels in On Primary Fixed.
- Warning strips and destructive-confirmation wells: Error Container fill, 1px On Error Container hairline, On Error Container text.
- No shadows at rest.

### Inputs / Fields
- **Style:** Surface Lowest, 1px hard black border, square, 0.5rem padding, Body type. Labels sit strictly above the field in caps-label style.
- **Readonly:** Surface Container Low fill, On Surface Variant text, `not-allowed` cursor — used for the auto-computed base-currency equivalent.
- **Inline editable:** values edited in place (opening balances, category names) carry a dashed outline underline that turns Primary on hover.
- **Focus:** a 2px offset solid Primary outline via `:focus-visible` — the design's blue focus border, no glow.

### Navigation
- **Style:** desktop (≥ 769px) a fixed 256px left sidebar with a 1px black right border: brand block, status chip, three caps-label nav links with leading icons (Movements, Stats, Settings) where the active link is a light Primary Fixed tint with a 4px Primary left edge and ink text (hover is a neutral Surface Container shade), and footer actions (+ Quick Add, Backup). Primary is the only interactive blue in the sidebar: the Quick Add CTA fills with Primary, matching the nav's active edge. Mobile (≤ 768px) the same three links collapse into the fixed bottom nav bar sized by `--nav-bar-size` (3.5rem), above the safe-area inset — icons only, each anchor keeping an accessible name — with a sticky top bar carrying brand + status. The mobile bar gains a fourth, center slot: the capture action (#103) — the one blue element on mobile, a square Primary Container tile with the hard border and the shared press interaction, opening the capture bottom sheet. It never renders on desktop, where the sidebar's Quick Add CTA keeps that role.

### Signature Components
- **Backup Banner:** a non-interactive full-width status strip (Primary Fixed fill, Primary bottom hairline) with its content aligned to the centered content column via the chrome gutter. Status reads left: the method label ("Google Drive") in Primary Deep at 600, with the relative-time caption beneath it; a compact primary **Back up** button (`%btn-primary`/`%btn-small`) sits pinned right and is the strip's only interactive element. Offline, it degrades to Surface Container Low with the method and caption in On Surface and renders a genuinely disabled neutral button. Backup failures render an error strip in the error-container family below the banner, announced via `role="alert"`, with a small outline-danger Dismiss button. Its sibling Install Prompt uses the same strip language.
- **Movement Rows:** no Type column and no direction arrows — the 4px left edge stripe is the type's only signal: green (income), red (expense), grey (transfer). Amounts always render positive in JetBrains Mono, colored only by direction: Income green, Error red; transfers stay neutral ink. Actions are icon-only: pencil Edit, trash Delete (outline danger); Delete swaps the pair for tick (confirm, outline danger) / X (cancel) icon buttons with the prompt announced off-screen, and the Undo Toast covers recovery. On mobile (≤ 480px) the rows group under caps-label day dividers; see Layout for the day-section card spec.
- **Movement Filter Card:** progressive disclosure, borrowed from the exchange-rate capture (#102). Collapsed, the card is a single search row: the search field, removable outline chips — one per active filter (category, account, search), caps-label type on a 1px Outline stroke, the same tag treatment as the ledger's category chips — and a small Filters toggle carrying the active count. Expanded, a panel below the summary row (separated by an Outline Variant hairline, not a second card) reveals the Category and Account selects, each defaulting to its All categories / All accounts option so a filter select never renders blank, plus — once filters are active — the Clear filters action and, when a category filter narrows the scope, the transfers-excluded hint. Active filter counts render as a neutral outline tag — 1px Outline border, Surface Lowest fill, On Surface ink — never Primary: a count is metadata, not an affordance (the Blue Acts Rule). Removing a chip clears exactly that filter. On coarse pointers the toggle and chips rise to the 44px thumb minimum like every other tappable control.
- **Undo Toast:** a fixed, bottom-center Surface Lowest strip with a hard black border pairing the deleted-movement label with a small Undo button. It presses like every button; it never floats.
- **Capture Bottom Sheet (#103, #104):** on mobile both capture forms present in the same bottom sheet — a fixed Surface Lowest panel rising from the bottom edge to ~85% of the viewport, closed by the modal 2px On Surface top stroke. A drag handle at its top dismisses it: the sheet follows the finger 1:1 while dragging and dismisses once the travel passes a threshold (reduced-motion users get no slide-up animation). The form body scrolls inside the sheet with its fields in one column, while Cancel/Save stay pinned above an Outline Variant hairline at the sheet's bottom edge — always reachable regardless of form height. Quick Add and the Transfer editor are indistinguishable in their mobile presentation: the same sheet, the same one-column scroll, the same pinned actions; the Transfer's exchange-rate capture (the blue well) appears only when its source and destination accounts hold different currencies. Editing an existing Transaction or Transfer opens the same sheet prefilled; only one capture form is ever open. Desktop capture stays inline; the sheet never renders there. As a modal it enacts its `aria-modal` semantics (#106): while open, the page behind it cannot scroll and Tab cycles within the sheet; there is deliberately no scrim — the doubled top stroke is the sheet's only separation from the page (ADR 0015).
- **Tables:** headers are caps labels in On Surface Variant, rows separated by 1px Surface Container Low rules; Date is the first column; transfer rows tint Background and carry the grey stripe; amount cells are mono and colored only by direction; inactive rows dim to 0.6 opacity.

## Do's and Don'ts

### Do:
- **Do** build structure from hard black borders and tonal surface steps — color blocking over shadows.
- **Do** keep everything square: zero radius on every element, pills included.
- **Do** use caps labels (12px/700/+0.1em/uppercase) for all metadata — labels, headers, buttons, tags.
- **Do** render every amount in JetBrains Mono tabular figures, right-aligned in data tables.
- **Do** color money only by direction: Income green for money in, Error red for money out, neutral ink for transfers; the directional stripe carries the same signal.
- **Do** put warnings on the error ramp (Error Container fill, On Error Container ink) — there is no amber.
- **Do** press buttons (shadow shed + 2px shift on `:active`) instead of lifting them.

### Don't:
- **Don't** round anything, or cast a shadow at rest — the press shadow on buttons is the only shadow.
- **Don't** use gradients, glassmorphism, backdrop blur, or full-bleed color panels anywhere.
- **Don't** invent off-ramp grays or ad-hoc tints — every fill must belong to the surface ramp, the primary-fixed wash, or the error container before it touches a component.
- **Don't** let green act or blue signal money direction (D8 reversed): green is only income, blue is only action/information, and amber is retired.
- **Don't** set interface prose in mono or numbers in Inter — the two families have strict jobs.
- **Don't** whisper metadata in mixed case below the caps-label spec.

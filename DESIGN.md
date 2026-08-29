---
name: Open Expenses
description: A quiet, ledger-flat personal expense tracker.
colors:
  primary: "#2563eb"
  primary-deep: "#1e40af"
  income: "#15803d"
  expense: "#dc2626"
  neutral-bg: "#ffffff"
  neutral-surface: "#f9fafb"
  neutral-surface-muted: "#f3f4f6"
  neutral-border: "#e5e7eb"
  neutral-border-strong: "#d1d5db"
  neutral-text: "#374151"
  neutral-text-muted: "#6b7280"
  neutral-text-faint: "#9ca3af"
typography:
  headline:
    fontSize: "1.1rem"
    fontWeight: 600
  title:
    fontSize: "1rem"
    fontWeight: 500
  body:
    fontSize: "0.9rem"
    fontWeight: 400
  body-caption:
    fontSize: "0.85rem"
    fontWeight: 400
  label:
    fontSize: "0.8rem"
    fontWeight: 500
  tag:
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  pill: "9999px"
  tag: "3px"
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "2rem"
components:
  button:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  button-danger:
    backgroundColor: "{colors.expense}"
    textColor: "{colors.neutral-bg}"
    rounded: "{rounded.sm}"
    padding: "0.5rem 1rem"
  button-small:
    rounded: "{rounded.sm}"
    padding: "0.25rem 0.5rem"
  card:
    backgroundColor: "{colors.neutral-bg}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  card-subtle:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "1rem"
  input:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "0.5rem"
  tag:
    backgroundColor: "#eff6ff"
    textColor: "{colors.primary}"
    rounded: "{rounded.tag}"
    padding: "0.125rem 0.375rem"
---

# Design System: Open Expenses

## Overview

**Creative North Star: "The Quiet Register"**

Open Expenses is the calm, precise successor to the trusted paper ledger — a spreadsheet made into furniture. Every screen is a page of an account book that never raises its voice: white paper surfaces, hairline rules between rows, and a single blue ink reserved for the places the user acts. The interface is honest utility first: nothing decorative earns space unless it helps the user record or read a number correctly.

Density is comfortable and scannable. Cards stack as clean ruled pages inside a centered 800px column; tables run hairline row rules and muted labels; forms sit in two-column gridded wells. Depth is flat by construction — one-pixel borders and gray surface steps carry structure, never shadows. The whole system is assembled from a small neutral ramp plus three functional accents (blue for action, green for income, red for expense), which is exactly as much color as a ledger needs.

The layout treats accuracy as the product. Type carries hierarchy through size and weight alone; amounts are always weighted 600 so figures stand out of the page at a glance; muted gray supplies context, faint gray signals absence. Nothing distracts, nothing nags, and every surface sits quietly behind the work of keeping money straight.

**Key Characteristics:**
- Flat, tonal, paper-based surfaces (no gradients, no glass, no shadows at rest)
- A single blue accent that only ever marks action, active state, or information
- Weight-driven type hierarchy on a neutral gray ramp
- Hairline borders (1px) as the universal separator
- Rounded corners kept small and functional (4px inputs to 8px cards)

## Colors

A neutral paper ramp of warm-cool grays carries the page; three functional inks do all the meaning. Blue is action, green is money in, red is money out or destruction. Tinted fills are rare and reserved for chips and warnings.

### Primary
- **Deep Ledger Ink** (#2563eb): The system's only accent. Primary buttons, the active tab's underline and text, the filter badge, tag text, info copy, and the browser theme color (`<meta theme-color>` is #2563eb). It marks where the user can act or where state is live.
- **Ink Well Blue** (#1e40af): The dark relative of the accent. Used for stronger accent text in tight spaces — the exchange-rate section heading and the backup banner's primary label.

### Neutral

The paper family. One ramp, five steps, everywhere.

- **Paper White** (#ffffff): Cards, page background, resting buttons, inputs, and table rows.
- **Mist Paper** (#f9fafb): The raised well under forms and filters — form cards, the filter bar, and transfer rows in the movements table.
- **Silvered Paper** (#f3f4f6): The muted step — readonly fields, the offline backup banner, and row-divider hairlines in tables.
- **Edge Graphite** (#d1d5db): The stronger hairline of interactive controls (input, select, and button borders).
- **Hairline Graphite** (#e5e7eb): The softer hairline of surfaces (card borders, tab bar rule, well borders).

Text runs on its own three-step ink ramp: **Body Ink** (#374151) for labels and detail, **Muted Slate** (#6b7280) for captions, table headers, inactive tabs, meta, and readable empty states, **Faint Ash** (#9ca3af) for placeholders, disabled hints, and disabled controls only.

### Warning (Amber)

A single sanctioned sub-ramp for signal strips that warn rather than destroy. It is the lone non-neutral fill beyond the functional inks and the ink-tint, reserved for status warnings like the Stats conversion failure.

- **Warning Surface** (#fef3c7): the tinted fill of the warning strip.
- **Warning Border** (#fcd34d): the hairline around the strip.
- **Warning Ink** (#92400e): the warning text.

### Danger (Red)

A second sanctioned sub-ramp for signal strips that destroy or report failure — destructive confirmations and error strips. It mirrors the amber ramp and is reserved for the restore-confirmation well and the backup error strip.

- **Danger Surface** (#fef2f2): the tinted fill of destructive-confirmation wells and error strips.
- **Danger Border** (#fecaca): the hairline around those wells and strips.
- **Danger Ink** (#dc2626): red text at UI scale (Officer's Red) — outline danger buttons and row-level intent.
- **Danger Text** (#b91c1c): the text ink for copy sitting on the danger tint — Danger Ink alone fails AA on the tinted surface.
- **Danger Edge** (#fca5a5): the hairline of outline danger buttons — red intent at row density.

### Name Rules

**The Ledger's Ink Rule.** Deep Ledger Ink appears only on action, active state, and information. It is never a background fill, never a full-bleed panel, never decoration. Blue on a screen means "here is where you do something." Derived, computed figures — such as the Stats Net and Avg Monthly Savings amounts — are information, not money in or out, so they read in Deep Ledger Ink rather than green or red.

**The Paper Ramp Rule.** Surface stepping uses only the neutral paper family (Paper White → Mist Paper → Silvered Paper). Tinted fills are limited to the tag chip's ink-tint (#eff6ff), the ink-tint hover step (#dbeafe), the exchange-rate callout, the backup banner, status wells (amber), and danger wells (#fef2f2) — never as gratuitous cards.

## Typography

**Display Font:** none — no webfont is loaded anywhere.
**Body Font:** a declared system stack, `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`, set once on `body` and inherited by every control; loads zero webfonts.

**Character:** The system deliberately does no typographic expression. There is no font pairing and no display face; the only sanctioned letter-spacing is the micro-tracking (`--tracking-micro`, 0.01em) applied to labels, table headers, and tags. Hierarchy is produced entirely by size and weight on the neutral ramp. The type is the ink of the register: flat, legible, and interchangeable, which is the honest consequence of a utility-first tool that loads no webfont.

### Hierarchy
- **Headline** (600, 1.1rem): Card titles (`h2` inside cards).
- **Title** (500, 1rem): Onboarding heading and page-level `h1`.
- **Body** (400, 0.9rem): Buttons, inputs, selects, and general content.
- **Body Caption** (400, 0.85rem): Secondary explanation, backup timestamps, error messages.
- **Label** (500, 0.8rem): Form field labels, table headers, tiny helper text.
- **Tag / Meta** (500, 0.75rem): Tags, chips, badges, inline type labels, relative-time text — the recognized floor.

Amounts are always **600 weight** at their size (1.25rem stat values on Stats, row figures in tables), making figures the loudest thing on any screen.

### Name Rules

**The Ink Is the Voice Rule.** Hierarchy is carried by size and weight alone. Never add color, italics (except the accepted note-italic), underlines, or styling tricks to make text stand out — the figures and headings already do that by weight.

**The No-Whisper Rule.** Nothing renders below 0.75rem. Faint Ash is for placeholders and disabled hints; type that users must read — empty states included — renders in Muted Slate, never Faint Ash at a small size.

## Layout

A single centered column, `max-width: 800px` (`main.content` in the shell), padded 1rem on each side, `margin: 0 auto`. The onboarding flow narrows to 600px. The chrome strips above the content — install prompt, backup banner, error strip, and the tab bar — span full width edge-to-edge, but their inner content aligns to the centered content column via the shared chrome gutter (`--chrome-gutter`); only the tab bar is sticky.

The tab bar is a 3-up equal flex row, sticky at `top: 0`, its links constrained to the content column by the chrome gutter. Cards stack vertically with 1rem gutter (a 1rem bottom margin on each card). Forms lay out on a two-column grid (`1fr 1fr`, 0.75rem gap); the Quick Add card's compact mode uses `1.5fr 1fr 1fr` so the amount column reads widest. Tables are full-width, `border-collapse: collapse`, with 0.5rem cell padding.

Spacing rhythm is a 4-step scale — 0.5rem (button clusters, table cells), 0.75rem (form-grid gutters, heading offsets, action rows), 1rem (card padding, page padding, card gutters, section spacing), 2rem (Stats stat groups). A single breakpoint at 560px handles phones: form grids and the Quick Add compact grid collapse to one column, Stats stat groups wrap, the filter bar and controls wrap, and the movements table gains a horizontal scroll container. Above it, the column simply reflows.

## Elevation & Depth

The system is **flat by default**. Structure is carried entirely by 1px hairlines and tonal surface steps (Paper White on Mist Paper on Silvered Paper); there are no drop shadows, no gradients, and no backdrop treatments anywhere in the chrome. Depth means "which step of paper this sits on," nothing more.

The single sanctioned shadow is a float: the tag-input suggestion dropdown lifts off the page with `box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)`. Floating menus may cast a small ambient shadow; resting surfaces never do.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)`): Only the tag-input's autocomplete dropdown (`.tag-input .suggestions`).

### Name Rules

**The Flat-By-Default Rule.** Depth is tonal, never shadowed. A surface that isn't floating in a menu has no shadow, ever. Hover on a button darkens ink — it never lifts, scales, or casts.

## Shapes

Corners are small and consistent, scaled to the size of the element rather than its importance. Inputs, selects, and buttons are the least rounded (4px); elevated wells go slightly softer (6px); cards open to 8px; chips and tags are near-square (3px). The only fully round silhouette is the filter badge pill (9999px), which signals count.

Borders are uniformly 1px hairlines whose darkness encodes role: surfaces use Hairline Graphite, interactive controls use Edge Graphite, active/primary edges reuse the control's ink. Tables replace vertical borders with row rules (1px Silvered Paper).

## Components

### Buttons
- **Shape:** 4px radius, 1px hairline border, `cursor: pointer`, 0.9rem Body text.
- **Default / Secondary:** Paper White fill, Body Ink text, Edge Graphite hairline. Hover darkens text toward near-black; no lift, no shadow.
- **Primary:** Deep Ledger Ink fill, Paper White text, Ink border. Reserved for the single prominent action on a form or view (`+ Transaction`, `Save`, backup).
- **Danger:** two sanctioned treatments — **filled** Officer's Red with Paper White text for panel/card-level destructive confirmations (restore), and **outline** Officer's Red text with a red-300 (#fca5a5) hairline for anything inside a table row or dense list — including in-row confirmation buttons.
- **Small:** reduced padding (0.25rem 0.5rem) and 0.8rem type for table-row actions and the install prompt.
- **Disabled:** 0.6–0.7 opacity, default cursor.

### Tags / Chips
- **Style:** ink-tint fill (#eff6ff), Deep Ledger Ink text, 3px radius, 0.75–0.8rem, 500 weight. Appear in the movements table as category/grouping chips and in the tag input as removable chips with a small ×. A **neutral chip variant** (Hairline Graphite #e5e7eb fill, Body Ink text, same geometry) labels transaction type inline in movement rows.

### Cards / Containers
- **Corner Style:** 8px radius.
- **Card:** Paper White, 1px Hairline Graphite border, 1rem padding. The universal unit of Stats and Settings content.
- **Form Card:** Mist Paper fill, Hairline Graphite border, 8px, 1rem padding. The raised well for transaction/transfer editors.
- **Filter Bar:** Mist Paper, Hairline Graphite border, 6px, 0.75rem padding.
- No shadows at rest; dividers between stacked cards come only from their own gutters.

### Inputs / Fields
- **Style:** Paper White, 1px Edge Graphite border, 4px radius, 0.5rem padding, 0.9rem type. Labels sit above the field (column flex, 0.8rem Muted Slate).
- **Readonly:** Silvered Paper fill, Muted Slate text, `not-allowed` cursor — used for the auto-computed base-currency equivalent.
- **Inline editable:** values edited in place (opening balances, category names) carry a dashed Edge Graphite underline that turns Deep Ledger Ink on hover — editability signaled without summoning a field.
- **Focus:** keyboard focus is always visible — a flat 2px Deep Ledger Ink outline (via `:focus-visible`), no glow, no shadow. On hover and at rest the boundary follows the Edge/own-ink darkening described above.

### Navigation
- **Style:** a sticky top tab bar of three equal links (Movements, Stats, Settings), 1px Hairline Graphite rule beneath. Resting tabs are Muted Slate at 500; hover darkens to Body Ink (#374151) — the ramp's darkest step, never a stray near-black; the active tab is Deep Ledger Ink with a 2px Ink underline replacing the rule. No pill, no filled background — active state is the underline alone.

### Signature Components
- **Backup Banner:** a non-interactive full-width status strip (ink-tint #eff6ff fill, #bfdbfe bottom hairline) with its content aligned to the centered content column via the chrome gutter. Status reads left: the method label ("Google Drive") in Ink Well Blue at 600, with the relative-time caption ("Last backup: …") in Ink Well Blue beneath it; a compact primary **Back up** button (`%btn-primary`/`%btn-small`) sits pinned right and is the strip's only interactive element — hover deepens the button to Ink Well Blue, never the strip. Offline, it degrades to Silvered Paper with the method and caption in Muted Slate and renders a genuinely disabled neutral button (native `disabled`), so assistive tech hears a real disabled control. Backup failures render an error strip in the danger tint (#fef2f2 fill, #fecaca hairline) below the banner, announced via `role="alert"`, with provider codes mapped to one ledger-voice sentence (raw code demoted to the `title`) and a small outline-danger Dismiss button in Danger Text. Its sibling Install Prompt uses the same strip language.
- **Movement Rows:** each row opens with the Direction Arrow rendered at 600 weight — a right arrow → for income, left ← for expense, equals = for transfer — in Ledger Green, Officer's Red, or Muted Slate respectively. Amounts always render positive, in 600 weight, colored only by income/expense direction. Cross-currency rows show original → converted (e.g. `$10.00 → €8.57`).
- **Undo Toast:** a fixed, bottom-center Paper White strip (6px, Hairline Graphite border) pairing the deleted-movement label with a small Undo button. It floats but casts no shadow — the Flat-By-Default Rule spares nothing at rest.
- **Tables:** headers are 0.8rem Muted Slate at 500, rows separated by 1px Silvered Paper rules; transfer rows tint Mist Paper; amount cells are 600-weight and colored only by direction; inactive rows dim to 0.6 opacity.

## Do's and Don'ts

### Do:
- **Do** build depth from the paper ramp — Paper White, Mist Paper, Silvered Paper — with 1px hairline borders.
- **Do** reserve Deep Ledger Ink for actions, the active tab, tags, and info; let figures speak through 600-weight type instead.
- **Do** keep corners small and role-scaled: 4px controls, 6px wells, 8px cards.
- **Do** color amounts only by direction: Ledger Green for income, Officer's Red for expense, gray for transfers.
- **Do** render derived figures (Net, Avg Monthly Savings) in Deep Ledger Ink as information, never in income/expense green or red.
- **Do** signal destructive confirmations with the filled danger button and anything inside a table row or dense list with the outline danger hairline; render destructive-confirmation wells and error strips in the danger tint family.

### Don't:
- **Don't** add drop shadows to cards or buttons (float shadows belong only to menus).
- **Don't** use gradients, glassmorphism, backdrop blur, or full-bleed color panels anywhere.
- **Don't** invent off-ramp grays or ad-hoc tints (#ccc, #eee, #666, one-off washes) — every fill beyond the paper ramp must belong to a sanctioned family (ink-tint, amber, danger) before it touches a component.
- **Don't** round controls past 4px, and never move an active tab's affordance off the underline.
- **Don't** whisper content below 0.75rem or render readable copy (empty states included) in Faint Ash.
- **Don't** let the primary accent fill a whole screen or decorate a card background.
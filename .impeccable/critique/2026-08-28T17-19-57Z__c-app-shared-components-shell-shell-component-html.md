---
target: the banner and tab navigation
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-28T17-19-57Z
slug: c-app-shared-components-shell-shell-component-html
---
# Critique: Shell Chrome — Tab Navigation + Backup/Install Banners

Target: `src/app/shared/components/shell/shell.component.html` (+ `shell.component.scss`, `backup-banner.component.ts`, `install-prompt.component.ts`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | States are honest, but the relative timestamp is memoized and never ticks — "Just now" freezes for hours |
| 2 | Match System / Real World | 2 | Plain voice mostly, but raw OAuth codes (`popup_closed_by_user`) leak into the error strip |
| 3 | User Control and Freedom | 2 | Error strip undismissable; one stray tap commits you to an OAuth popup flow |
| 4 | Consistency and Standards | 3 | Install buttons hand-roll `.btn` styles (no hover) instead of the `_patterns.scss` placeholders |
| 5 | Error Prevention | 2 | A ~360×41px full-width button is the trigger for a consequential action; Install/Dismiss sit adjacent at ~26px |
| 6 | Recognition Rather Than Recall | 3 | Good labels; undermined by the frozen clock |
| 7 | Flexibility and Efficiency | 2 | No "already backed up, leave me alone" affordance for repeat use |
| 8 | Aesthetic and Minimalist Design | 3 | Two identical blue strips stack into one slab; full-bleed strips detach from the 800px column |
| 9 | Error Recovery | 1 | Raw codes, no recovery guidance, no dismissal, no `aria-live` — failure is silent to screen readers |
| 10 | Help and Documentation | 2 | None in chrome; the error strip is exactly where one line of "what now" is needed |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

Applicable maximum: 40 (no heuristics scored n/a).

## Design Specificity Verdict

**LLM assessment:** The chrome is materially authored for "The Quiet Register" — every surface resolves through the token layer, the active tab is underline-only, "Last backup: Never" is genuine ledger voice, and DESIGN.md documents these exact strips. Not category-interchangeable. But it is specific in *material*, not *behavior*: a double-nag banner stack, a full-width tap target that silently launches Google OAuth, and a status line that stops telling the truth are generic PWA chrome behaviors wearing ledger clothes. The system's own north star — "nothing distracts, nothing nags" — is contradicted by the chrome's first open.

**Deterministic scan:** Exit code 2, 1 advisory finding — `design-system-color`: "text color rgb(0, 0, 0) on a 'Movements' is outside DESIGN.md colors" at `shell.component.html:0`. Assessed as a false positive: the detector's static-HTML engine builds a simulated DOM but only loads stylesheets via `<link>`; Angular injects `shell.component.scss` at build time, so the tab's real color (`--muted-slate`) is invisible to it and the computed color falls back to DOM default black. No authored `rgb(0,0,0)` exists in the shell. The same blind spot means contrast checks never ran against the two `.ts` inline templates — where the worst contrast violations live. Detector caught nothing the review missed; the review caught three contrast failures the detector structurally cannot see.

**Visual overlays:** None — no browser automation tool exposed in session; no live-server injection attempted.

## What's Working

- **The offline state is designed, not defaulted** (`backup-banner.component.ts:16,49–53`): Silvered Paper fill, muted ink, native `disabled` so assistive tech announces a real disabled control. Matches PRODUCT.md's offline-first soul.
- **Underline-only active tab** (`shell.component.scss:26–29`): Deep Ledger Ink text + 2px ink rule replacing the hairline — exactly the spec's "active state is the underline alone."
- **Dismiss is permanent** (`pwa-install.service.ts:49–53`): one "Dismiss" forever, not a per-session nag cycle.

## Priority Issues

1. **[P1] The backup banner is a full-width button that launches OAuth.** The right half of the strip reads as passive status ("Last backup: 3 minutes ago") but the entire ~360×41px surface is a `<button>` — a pocket-tap/scroll-tap hazard that summons a Google login popup from the top of every screen. **Fix:** render the strip as a `<div>`/`<section aria-label="Backup status">` with the timestamp as plain text and only a compact "Back up" button (`%btn-primary`/`%btn-small`) interactive. Suggested command: `/impeccable shape`.

2. **[P1] Contrast failures are baked into the sanctioned palette.** "Last backup" caption `--ledger-ink-bright` (#3b82f6) on `--ink-tint` (#eff6ff) ≈ 3.4:1 at 0.85rem (fails AA); offline "Offline" `--faint-ash` on `--silvered-paper` ≈ 2.3:1; error text (#dc2626 on #fef2f2) ≈ 4.4:1, just under. DESIGN.md sanctions all three pairings — the system itself is the bug. **Fix:** `--ink-well-blue` for the timestamp, Muted Slate for the offline caption, darken the danger ink; amend DESIGN.md. Suggested command: `/impeccable polish`.

3. **[P1] The relative-time status lies.** `lastBackupDisplay` (`backup-banner.component.ts:89–93,109–120`) is a `computed` over `lastBackupAt()`; `new Date()` is a non-reactive dependency, so the memoized string renders once — "Just now" stays "Just now" for hours. **Fix:** drive it from a reactive minute-tick signal; cap the format at "Yesterday"/date. Suggested command: `/impeccable harden`.

4. **[P1] Failure is silent, technical, and sticky.** The error `<p>` (`backup-banner.component.ts:21–23`) has no `role="alert"`/`aria-live`, the message is the raw exception or OAuth code, and it persists undismissable while pushing the sticky tab bar down. **Fix:** add `role="alert"`, map provider errors to one ledger-voice sentence ("Google sign-in was cancelled — try again when ready") with the code as `title`, add a small Dismiss. Suggested command: `/impeccable clarify`.

5. **[P2] Navigation is unlabeled, uncurrent, and unskippable.** The `<nav>` has no `aria-label` (`shell.component.html:3`), the active tab carries only a visual class — no `aria-current="page"` — and there's no skip link past the banner stack to `<main>`. **Fix:** `aria-label="Primary"`, bind `[attr.aria-current]`, visually-hidden skip link. Suggested command: `/impeccable polish`.

## Persona Red Flags

**Alex (Power User):** The timestamp freezes — he backs up, works four hours, and the chrome still says "Just now." On his 2560px desktop, `justify-content: space-between` pulls the banner's label and timestamp ~2000px apart while tabs stretch edge-to-edge over an 800px column — the chrome stops belonging to the page.

**Sam (Accessibility-Dependent):** "Last backup" fails AA at 3.4:1; "Offline" renders at 2.3:1; backup failure is inaudible (no live region); the button's accessible name concatenates status into the action ("Back up to Google Drive Last backup: Never"); no `aria-current` on tabs; Install/Dismiss side-by-side at ~26px tall; no skip link.

**Casey (Distracted Mobile User):** The entire blue strip is a tap target that opens a Google popup — one inattentive thumb-press at page top and she's in OAuth-land. On first open, both banners + tab bar eat ~130px before any content at 360px; neither banner wraps at 320px; the install banner pops in mid-scroll with no reserved space, shifting the page under her finger.

## Minor Observations

- Install-prompt buttons hand-roll `.btn` styles (`install-prompt.component.ts:28–41`) instead of `@extend %btn-*` from `_patterns.scss`, and ship no `:hover` state.
- The 560px breakpoint never touches the chrome — `shell.component.scss` has no media query; small-screen strip behavior is accidental, not authored.
- `isBackingUp = computed(() => this.backupService.isBackingUp())` wraps a signal in a computed for no benefit (`backup-banner.component.ts:94`).
- DESIGN.md says everything above content is "top-fixed/sticky," but only the tab bar actually is — decide and document deliberately.
- An error strip can coexist with offline state — a red strip above a silvered "Offline" banner tells a confusing two-line story.
- The banner stack spans full-bleed while content is a centered 800px column — on desktop the chrome detaches from the page.

## Questions to Consider

- Backup is a data-safety ritual, not a dashboard metric — should it own the loudest, most permanent slot in the chrome at all?
- The Ink Rule says blue means "here is where you do something." What does a screen-top of two stacked blue strips — and a blue timestamp — teach the user that blue means?
- If your status element's accessible name is "Back up to Google Drive Last backup: Never," is the `<button>` the wrong element, or is the strip trying to be two components at once?

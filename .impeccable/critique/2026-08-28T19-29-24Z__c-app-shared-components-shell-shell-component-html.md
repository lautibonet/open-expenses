---
target: the banner and tab navigation
total_score: 32
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-08-28T19-29-24Z
slug: c-app-shared-components-shell-shell-component-html
---
# Critique Re-run: Shell Chrome — Tab Navigation + Banners (post-fix)

Target: `src/app/shared/components/shell/shell.component.html` (+ SCSS/TS, `backup-banner.component.ts`, `install-prompt.component.ts`, `backup-errors.ts`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | OAuth connect phase (popup open) shows an enabled button and no state |
| 2 | Match System / Real World | 4 | Ledger-voice error sentences genuinely excellent |
| 3 | User Control and Freedom | 3 | Install dismiss is permanent with no reset path |
| 4 | Consistency and Standards | 3 | Offline copy inconsistency; offline contrast |
| 5 | Error Prevention | 3 | Double-invocation during OAuth connect unguarded |
| 6 | Recognition Rather Than Recall | 4 | |
| 7 | Flexibility and Efficiency | 3 | One-step backup from any page |
| 8 | Aesthetic and Minimalist Design | 3 | Stacked duplicate-tint moment on first open |
| 9 | Error Recovery | 3 | No retry affordance; unmapped errors render raw |
| 10 | Help and Documentation | 3 | Offline button conveys why via caption only |
| **Total** | | **32/40** | **Good — solid foundation** |

Applicable maximum: 40 (no heuristics n/a). Prior run: 23/40.

## Design Specificity Verdict

**LLM:** Still "The Quiet Register." Gutter math verified against .content's content-box 800px — alignment fix is correct, not approximate. Drift points: banner-in slide is the first motion in a motion-less system; two identical ink-tint strips stack on first open.

**Deterministic scan:** Exit 2, 1 advisory — the known static-engine false positive (rgb(0,0,0) DOM-default fallback; skip link is actually --ledger-ink on --paper-white). Net real findings: 0. Sidecar refresh now covers the danger/amber/ink-tint ramps. Detector structurally cannot see Angular component SCSS.

## What's Working

- Error copy architecture (backup-errors.ts): codes → ledger-voice sentences, code demoted to title.
- Verified gutter math incl. the 800–832px band.
- Accessibility scaffolding: skip link + programmatic focus, aria-label, aria-current, role="alert".

## Priority Issues

1. **[P1] Offline banner text fails AA — regression from the fix cycle.** --muted-slate (#6b7280) on --silvered-paper (#f3f4f6) ≈ 4.4:1 at 0.85rem. **Fix:** step offline text to --body-ink (≈9.4:1). Command: /impeccable polish.
2. **[P2] Backup button not disabled during OAuth connect** (connect() runs before isBackingUp is set). **Fix:** busy state before the connect branch. Command: /impeccable harden.
3. **[P2] Install banner insertion causes layout shift** (transform doesn't animate occupied space). **Fix:** animate max-height alongside, or document the one-time shift. Command: /impeccable adapt.
4. **[P2] Install dismiss is unrecoverable** (permanent localStorage flag). **Fix:** suppress for N days / per session. Command: /impeccable harden.
5. **[P3] Method copy inconsistency:** "Google Drive" vs "Google Drive backup". **Fix:** pick one form. Command: /impeccable clarify.

## Persona Red Flags

**Alex:** double-fireable OAuth popup; install prompt killed forever by one click; raw strings for unmapped failures.
**Sam:** offline caption 4.4:1; disabled button unfocusable with no programmatic tie to the Offline caption; title-attribute error code keyboard-unreachable; announced strip can be scrolled out of view.
**Casey:** ~140px chrome before content on a phone; mid-session banner insertion jolts the viewport.

## Minor Observations

- "Yesterday" covers 24–47h; date fallback drops the year.
- Async lastBackupAt load flashes "Never" on cold start.
- 60s interval runs even when the display is "Never".
- Skip link reveals at left: 0, outside the chrome gutter.
- Error strip text lacks overflow-wrap for 320px + long sentences.

## Questions to Consider

- Should the install prompt borrow the backup banner's ink-tint, or is Paper White the honest "this is the browser talking" strip?
- Is a permanently resident Back up button the right home for a manual action in a system that promises "nothing nags"?
- Does the relative-time clock earn its heartbeat, or would a static timestamp be truer to a register?

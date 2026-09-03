---
target: mobile view of the stats page + install prompt
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Users\\lauti\\Documents\\DevProjects\\open-expenses\\src\\app\\features\\dashboard\\dashboard.component.html"
target_fingerprint: "sha256:0bafc8a7ab2adb9f1926f159b1c7c4bd51ae64591bfa91b6955b177a7605f779"
target_path: "C:\\Users\\lauti\\Documents\\DevProjects\\open-expenses\\src\\app\\features\\dashboard\\dashboard.component.html"
timestamp: 2026-09-03T10-46-53Z
slug: rc-app-features-dashboard-dashboard-component-html
---
# Critique: /stats mobile view + install prompt

⚠️ DEGRADED: single-context (Assessment B — detector + browser-overlay agent — cancelled, then skipped at user request. Only the design review ran; no deterministic scan, no detector overlays.)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Month select silently governs only 3 of 5 cards; KPIs stay "2026 – YEAR TO DATE" regardless |
| 2 | Match System / Real World | 4 | "Year to date", "Avg €2,400/MO", ledger metaphor throughout |
| 3 | User Control and Freedom | 4 | Read-only surface; scope freely reversible |
| 4 | Consistency and Standards | 2 | 48px vs 24px gaps; nav 75px vs 56px token; install strip ≠ documented strip language |
| 5 | Error Prevention | 4 | Nothing destructive; conversion-degradation warning properly wired |
| 6 | Recognition Rather Than Recall | 2 | Net-by-Period figures exist only in a visually-hidden list |
| 7 | Flexibility and Efficiency | 3 | Two-tap scope change; nothing more a read-only view needs |
| 8 | Aesthetic and Minimalist Design | 3 | Strong composition diluted by gap inversion + triple-repeated scope label |
| 9 | Error Recovery | 3 | Conversion warning is per-occurrence dismissible; niche otherwise |
| 10 | Help and Documentation | 2 | Nothing explains the strip's above/below-midline = positive/negative convention |
| **Total** | | **30/40** | **Good** |

## Design Specificity Verdict

The mobile stats page is unmistakably authored for Monolith Ledger — the inverted solid-ink NET card, 4px directional stripes, JetBrains Mono tabular figures at 24px, hard 1px strokes, zero radius. Not category-generic. The one element breaking family resemblance is the install prompt, which ignores its own documented strip language (DESIGN.md:235 Primary-Fixed strip). Two localized defects in a disciplined system.

Deterministic scan: not run (skipped at user request). No user-visible overlays.

## Overall Impression

The page's bones are excellent — every figure cross-checks (9,600.00 − 1,521.89 = 8,078.11), negatives stay ink, the peak is the confident solid Net card, the scroll ends on a soft Account Balances card. The gap issue is real, measured, and has a one-line root cause. The install prompt shoves the page down 84px after load and advertises the app the user is already using.

## What's Working

1. The inverted Net card (dashboard.component.scss:81-103) — focal hierarchy built purely from stroke weight and fill, exactly the system's depth vocabulary.
2. Overflow-hardened KPI grid — `minmax(0, 1fr)` tracks with a documented rationale (dashboard.component.scss:23-29).
3. The Net strip's a11y duality — decorative bars `aria-hidden` + visually-hidden per-month figure list (dashboard.component.html:78-99).

## Priority Issues

**[P0] KPI trio gaps measure 48px vs 24px everywhere else**
- Why: the three KPI cards are the page's tightest logical group yet have the largest gaps; contradicts DESIGN.md's "cards stack vertically with 1rem gutter".
- Root cause (measured at 375px): grid gap 16px (--space-md, dashboard.component.scss:30) + `<dl>` UA default block margin 16px×2 not reset (SCSS resets only dt,dd at :42-45). Measured KPI↔KPI gaps: 48, 48; all section↔section gaps 24 (`.card { margin-bottom: var(--space-lg) }`, :110).
- Fix: `.kpi-card { margin: 0 }`. Then reconcile the documented 1rem gutter with the implemented 1.5rem section margins — pick one, update DESIGN.md or the SCSS.
- Command: /impeccable layout

**[P1] Install prompt — improve both implementation and style (cheaply)**
- Verified behavior: renders only on `beforeinstallprompt` (pwa-install.service.ts:23-27); static, scrolls away (top −527px after 600px scroll); sits under sticky top bar (shell.component.html:138); dismissed only via Dismiss button → localStorage `open-expenses_pwa_install_dismissed` timestamp, 7-day TTL (:4,:53); confirmed absent after reload + re-dispatch.
- Implementation gaps: (a) declining Chrome's native dialog is not remembered (install() sets canInstall(false), writes no key, :40-48); (b) no role/live region — appears ~1s after load, never announced; (c) 84px CLS push on arrival.
- Style gaps: white fill + 1px black border contradicts DESIGN.md:235 (Primary Fixed strip language); "INSTALL OPEN EXPENSES FOR QUICK ACCESS" sentence set in 12px caps-label — metadata styling for prose.
- Keep it non-fixed — DESIGN.md:185 sanctions non-sticky chrome strips; install is a low-urgency ask.
- Fix: persist dismissal/cooldown when native dialog declined; add role="status"; restyle to Primary Fixed strip; message to Body Caption. Buttons already 44px on coarse pointers (install-prompt.component.ts:77-81).
- Command: /impeccable harden + /impeccable polish

**[P1] The month select silently half-governs the page**
- Why: selecting a month changes category/balance cards while Income/Expenses/Net hold "2026 – YEAR TO DATE" (kpiScopeLabel() hardcodes year, dashboard.component.ts:247-249) — reads as a bug.
- Fix: let KPIs honor month scope, or visually detach the year-scoped trio behind a heavier boundary (2px rule or --space-xl).
- Command: /impeccable clarify

**[P2] Bottom nav renders 75px, not the documented 56px token**
- Why: `.tab` is content-box (no global border-box reset), so min-height 56px + 8px×2 padding + borders = 75px (shell.component.scss:224-239; measured), while `.main-area` offsets by only --nav-bar-size + safe-area (shell.component.scss:298). ~19px of page bottom can hide behind the bar. Top bar is 73px for the same reason.
- Fix: box-sizing: border-box on .tab/.top-bar, or size the bar with height: var(--nav-bar-size).
- Command: /impeccable layout

**[P2] Net by Period: values undiscoverable, baseline convention unexplained**
- Why: figures live in a visually-hidden list (dashboard.component.html:92); above/below-midline rule (dashboard.component.scss:168-175) never explained; fill caps at 50% (dashboard.component.ts:353-357) reads as arbitrary.
- Fix: show current month's figure as a caption under the strip + one-line caps legend ("ABOVE LINE = NET IN · BELOW = NET OUT").
- Command: /impeccable clarify

## Persona Red Flags

- Casey (distracted mobile): banner shoves page down 84px mid-load; month select changes only the bottom half; 40px-tall selects easy to mis-tap (below the 44px thumb minimum applied to buttons but not selects).
- Sam (a11y): install banner appears with no live region, never announced; scope selects 40px < 44px; focus-visible outline present globally (styles.scss:158-161); hidden figure list is excellent.
- Riley (stress tester): long category names wrap safely (343px probe, no overflow); huge figures guarded by minmax(0,1fr); only unguarded growth path is an uncapped category list.

## Minor Observations

- "Savings Rate: 84%" renders in JetBrains Mono — prose in the data font, against Numbers-Are-Mono (dashboard.component.scss:97-102).
- Scope selects have no coarse-pointer 44px rule anywhere in _patterns.scss (measured 40px).
- No loading state between scope change and data swap (IndexedDB fast; likely fine).
- Full-page screenshot captures painted the bottom nav mid-page — stitch artifact, not real overlap (live rects confirm bar at 737-812).

## Questions to Consider

1. If Income, Expenses, and Net are one group, why do they sit farther apart (48px) than complete strangers (24px)?
2. The only "no" the banner remembers is the tiny Dismiss button; the native dialog's "no" is forgotten on reload. Install funnel or nag generator?
3. Should a read-only summary page have a control that only half-governs the page?

## Appendix: Spacing measurements (375×812, dsf 2, seeded data)

| Between | Gap |
|---|---|
| header.page-header → conversion-warning (h=0) | 24px |
| conversion-warning → section.kpi-row | 0px |
| kpi-row → net-strip-card | 24px |
| net-strip-card → category card | 24px |
| card → total-balance card | 24px |
| card → account-balances card | 24px |
| KPI Income → KPI Expenses (inside grid) | 48px |
| KPI Expenses → KPI Net (inside grid) | 48px |

Screenshots: stats-mobile-375-full.png, install-prompt-375-viewport.png, install-prompt-375-full.png, stats-767-full.png (temp dir).

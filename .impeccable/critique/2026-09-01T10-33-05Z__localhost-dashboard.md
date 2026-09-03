---
target: "the stats page at http://localhost:4200/dashboard"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-09-01T10-33-05Z
slug: localhost-dashboard
---
# Design Critique — Stats Page (`/dashboard`)

**Method: dual-agent (A: ses_fa3831a26ffe2CzfosOmQGC0W0 · B: ses_fa382d048ffeEDeVgkTbcoQIXH)**

*No browser automation was available (no playwright/puppeteer, none cached), so there is no live-browser overlay; the critique rests on source review + the deterministic CLI scan. Dev server verified live (HTTP 200).*

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading state — figures render €0.00 then pop in async; a missing rate silently drops an account from the total with zero status |
| 2 | Match System / Real World | 2 | "September 2026 Total Balance" is an **all-time** figure; KPI cards are **year** totals with no year label — the page's time scopes lie |
| 3 | User Control and Freedom | 3 | Solid; scope not URL-persisted, so refresh resets to current month |
| 4 | Consistency and Standards | 3 | Tokens rigorous, but Movements paints negative net red while Stats keeps it ink — same data, two grammars |
| 5 | Error Prevention | 3 | Read-only page is safe, undermined by the `baseCurrencyAmount ?? amount` path summing foreign amounts as-if base |
| 6 | Recognition Rather Than Recall | 2 | User must hold "KPIs = year, sections = month"; switching year silently resets month to today |
| 7 | Flexibility and Efficiency | 2 | No year view, no trend, no shortcut; comparing two months means flipping selects and memorizing numbers |
| 8 | Aesthetic and Minimalist Design | 4 | Excellent — zero radius, hard strokes, tabular mono, earned inversion on the Net card |
| 9 | Error Recovery | 3 | Honest offline conversion strip (`role="alert"`), but no retry and the silent `if (!rate) continue` path has no surface |
| 10 | Help and Documentation | 2 | Subtitle is the only guidance; first run is a wall of zeros and a heading over an empty list |
| **Total** | | **26/40** | **Acceptable** |

Cognitive load: 2/8 checklist failures (chunking — unbounded category list; working memory — mixed time scopes with no on-screen reminder). Low-to-moderate band.

## Design Specificity Verdict

**Verdict: authored.** The inverted solid-ink Net card is pure Monolith-Ledger color-blocking depth, the `AVG €X/MO` caption is spreadsheet-native copy no fintech dashboard would write, every figure runs mono tabular, and the category bars are deliberately chart-lib-free gray-track/black-fill. The one generic-idiom import — the KPI-card triptych — is fully digested by the system.

**Deterministic scan:** 1 advisory finding (`design-system-color`: "rgb(0,0,0) text outside DESIGN.md" at `dashboard.component.html` line 0). Judged a **false positive** — the static jsdom engine doesn't load Angular `styleUrl` SCSS, so the element falls back to the UA default black; the authored color is `var(--on-surface)` (#1a1c1c), in-palette. No real rule fired. The detector caught nothing the review missed.

**Visual overlays:** none — no browser session could be launched.

## Overall Impression

Strong bones wearing a weak argument. The visual system is nearly flawless, but the page *lies about time*: two incompatible scopes (all-time balances, year KPIs, month sections) share headings that claim otherwise, and the page never does its stated job of yearly trends. Biggest opportunity: make every number share one honest time scope and give the page a 12-month spine.

## What's Working

1. **The inverted Net KPI** — solid ink fill with surface-white figures is the design thesis executed as emphasis; the page's decision-relevant peak, zero shadows.
2. **Total mono/tabular discipline** — all figures read as one ledger column; caps-flavored copy authored for a spreadsheet replacement.
3. **Honest conversion degradation** — offline/failed rates fall back to base-currency accounts and say so in an on-ramp alert strip.

## Priority Issues

1. **[P0] The scope lie: two incompatible time scopes, neither labeled.** `stats.totalBalance`/`accountBalances` interpolate "September 2026" into headings for all-time sums, while KPI values are year totals under labels that just say "Income / Expenses / Net". **Fix:** strip scope from balance headings ("Total Balance · AS OF TODAY"); add caps label to each KPI ("2026 TO DATE · AVG OF 8 MO"). → `/impeccable clarify`
2. **[P0] "Yearly trends" — the page's stated job — is missing.** No month-by-month view exists. **Fix:** a 12-month bar strip as the page's spine under the KPI row — pure CSS, ink fills, mono month initials, red stripe on negative months. → `/impeccable shape`
3. **[P1] Silent multi-currency holes.** `t.baseCurrencyAmount ?? t.amount` adds foreign amounts into base sums when the stored conversion is missing; `if (!rate) continue` drops an account from the total with no warning. **Fix:** treat missing conversion as the same warning state; extend `conversionWarning` to cover transaction sums and dropped accounts. → `/impeccable harden`
4. **[P1] Zero/empty states are absent.** Empty month makes the category card vanish wholesale; empty year is three €0.00 cards with the Net card inverting black for zero; balances heading sits over an empty `<ul>`. Reuse `%empty-state` (already exists for Movements). → `/impeccable onboard`
5. **[P2] Cross-page color drift on identical data.** Movements' net-flow card flips red when negative and paints IN/OUT green/red; Stats' negative Net stays white-on-black and its Income value is ink behind a green stripe. Pick one rule, record it in DESIGN.md. Related: mono ships at 500 only but `.value` requests 700/600 → faux-bold figures; currency appears twice per balance row. → `/impeccable document`

## Persona Red Flags

**Alex (impatient power user):** Comparing two months = change scope, memorize number, change again. `onScopeYearChange` resets his month to *today* whenever he switches year. The average he wants monthly is the 0.875rem caption; the 2rem headline is the year total — inverted prominence. F5 resets scope; no URL param, no shortcut.

**Sam (screen reader + keyboard):** Live region announces "September 2026", then "Income, €42,000.00" — nothing associates the figure with the year; `kpi-row`'s `aria-label` is just "Stats", duplicating the h1. KPI cards are bare `div`/`span` pairs — no `dl`/heading association; rotor pass reads orphaned numbers. The false "September 2026 Total Balance" heading is equally false non-visually. First run: "Account Balances" `h2`, then an empty `<ul>`. Keyboard itself is fine.

## Minor Observations

- `transferService.getAll()` inside the per-account loop — O(accounts × full-table) refetches on every scope change.
- Card horizontal padding is `--space-lg` (1.5rem) vs DESIGN.md's card spec of 1rem.
- No compact formatting: a €1,234,567.89 year total in 2rem mono strains the 800px column.
- No `aria-live` on data refresh — totals silently swap after the async load.
- Route is `/dashboard` but nav and h1 say "Stats" — cosmetic identity mismatch.
- Two divider tokens on one page (balance rows `--surface-container-low`, bar tracks `--outline-variant`) — both sanctioned, unexplained.

## Questions to Consider

- Is the year total actually the number you check when you open Stats monthly — or is it the month and the average? What if the KPI row led with month figures and demoted the year to a caption?
- The category bars scale relative-to-max but never say so — would a mono `XX%` share beside each amount make the chart self-explanatory, and should category 9+ collapse into an "Other" ledger line?
- What is this page's one-sentence job — "how did last month go?" or "where do I stand?" If the former, the 12-month trend is the spine and the balance cards are the appendix.

---

# Browser Evidence Addendum (2026-09-01, post-initial-critique)

Round driven via Browser MCP extension (browser_navigate / snapshot / click / screenshot). Screenshots in `%TEMP%\opencode\bmcp-round\`.

## New finding — [P1] Root component kills deep links on every full page load

`src/app/app.ts:16-24`: root `ngOnInit` unconditionally `router.navigate(['/movements'])` after the onboarding check, never honoring the loaded URL. Empirically confirmed: full page load at `/dashboard` → URL ends at `/movements`; in-app sidebar click "Estadísticas" → stays on `/dashboard`. Breaks refresh-on-Stats, bookmarks, PWA restored state, and shows a visible flash of the correct page before the yank. **Fix:** only redirect when the router is still at the empty path (`router.url === '/'`); onboarding-incomplete keeps priority.

## Visually confirmed from the critique

- **P0 #1 scope lie, confirmed in pixels:** KPI cards show year totals (29.087,62 € ≈ 9-month avg × 9) under bare "INGRESOS/GASTOS/NETO" labels with no year scope; "SALDO TOTAL DE SEPTIEMBRE 2026" (24.353,03 €) is an all-time sum under a month heading; the category card ("GASTOS DE SEPTIEMBRE 2026 POR CATEGORÍA", sums to the month's 212,47 € salida) is genuinely month-scoped. Three time scopes on one screen, none honestly labeled.
- **Sam's KPI red flag, confirmed in the live a11y tree:** the KPI row is a single region whose accessible content is a flat string — "Ingresos 29.087,62 € MEDIA 3231,96 €/MES Gastos …" — no per-card label/value association.
- **Category bars** scale relative-to-max (confirmed: Hogar - Luz fills full width as the max) with no stated basis.
- **Detector false positive corroborated:** text renders as the designed near-black ink, not the detector's claimed rgb(0,0,0) fallback.

## Round limitations (recorded fallback signals)

- No viewport-control tool → mobile rendering unverified this round.
- No eval/script-injection tool → detect.js live overlay not possible; evidence is screenshots + a11y tree + CLI scan.
- Empty/zero states and loading pop-in not exercised (real user IndexedDB data; not modified).


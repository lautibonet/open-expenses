import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const patternsScss = readFileSync(resolve('src/app/shared/styles/_patterns.scss'), 'utf-8');
const quickAddScss = readFileSync(
  resolve('src/app/features/movements/quick-add-card/quick-add-card.component.scss'),
  'utf-8',
);
const movementsScss = readFileSync(
  resolve('src/app/features/movements/movements.component.scss'),
  'utf-8',
);
const rateWellScss = readFileSync(
  resolve('src/app/shared/components/exchange-rate-well/exchange-rate-well.component.scss'),
  'utf-8',
);

// Issue #107: the Transaction Form and the Transfer Form render from one
// visual grammar. The capture-form style blocks exist once, in the shared
// pattern library; each form extends them and owns no copies of its own.
describe('shared capture-form style placeholders (#107)', () => {
  it('defines the capture-form blocks once in the shared pattern library', () => {
    expect(patternsScss).toMatch(/%capture-form-grid\s*\{/);
    expect(patternsScss).toMatch(/%capture-form-actions\s*\{/);
    expect(patternsScss).toMatch(/%capture-rate-grid\s*\{/);
    // @extend cannot cross a media-query boundary, so the pinned sheet
    // actions ship as a mixin — the same rationale as sr-only.
    expect(patternsScss).toMatch(/@mixin capture-sheet-actions\s*\{/);
  });

  it('resolves text-like inputs and selects to the same rendered width (box-sizing)', () => {
    expect(patternsScss).toMatch(/%field\s*\{[^}]*box-sizing:\s*border-box/);
  });

  it.each([
    ['Transaction Form', quickAddScss],
    ['Transfer Form', movementsScss],
  ])('the %s extends the shared blocks instead of owning copies', (_name, scss) => {
    expect(scss).toMatch(/\.form-grid\s*\{[^}]*@extend %capture-form-grid/);
    expect(scss).toMatch(/\.form-actions\s*\{[^}]*@extend %capture-form-actions/);
    expect(scss).toMatch(/@include capture-sheet-actions/);
  });

  // Issue #108: the well is a shared component; it — not the capture forms —
  // extends the exchange-rate placeholders.
  it('the shared Exchange Rate Well extends the rate blocks instead of owning copies', () => {
    expect(rateWellScss).toMatch(/\.exchange-rate-section\s*\{[^}]*@extend %exchange-well/);
    expect(rateWellScss).toMatch(/\.exchange-rate-grid\s*\{[^}]*@extend %capture-rate-grid/);
    expect(rateWellScss).toMatch(/\.rate-status\s*\{[^}]*@extend %rate-status/);
    expect(rateWellScss).toMatch(/\.rate-error\s*\{[^}]*@extend %rate-error/);
    expect(rateWellScss).toMatch(/\.rate-source\s*\{[^}]*@extend %rate-source/);
  });

  it('deletes the per-component copies', () => {
    for (const scss of [quickAddScss, movementsScss]) {
      // Grid geometry now comes from the library — the unguarded 1fr 1fr
      // tracks are gone, and the pinned-actions declarations with them.
      expect(scss).not.toMatch(/grid-template-columns:\s*1fr\s+1fr/);
      expect(scss).not.toMatch(/position:\s*sticky/);
      expect(scss).not.toMatch(/form-actions[^{]*\{[^}]*flex-wrap:\s*wrap/);
      // The well blocks live in the shared well component now (#108).
      expect(scss).not.toMatch(/@extend %exchange-well/);
      expect(scss).not.toMatch(/@extend %capture-rate-grid/);
    }
  });

  it("keeps the Transaction Form's look where the two forms drifted", () => {
    // The minmax(0, 1fr) overflow guard (#100)...
    expect(patternsScss).toMatch(
      /%capture-form-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)/,
    );
    // ...and the --space-md spacing tokens, not the Transfer form's --space-lg.
    expect(patternsScss).toMatch(
      /@mixin capture-sheet-actions[\s\S]*?calc\(-1 \* var\(--space-md\)\)/,
    );
    expect(movementsScss).not.toMatch(
      /calc\(-1 \* var\(--space-lg\)\) calc\(-1 \* var\(--space-lg\)\)/,
    );
  });
});

# Releases: GitHub Releases tied to `v*` tags

How versioning and publishing work in this repo, and what an agent must do when asked to release.

## The flow

1. **Bump** `package.json` `version` in a dedicated `chore: bump version to X.Y.Z` commit.
2. **Write the notes**: create `.github/release-notes/vX.Y.Z.md` with the release's user-facing highlights (Sections like `## Highlights`, bullets summarizing what shipped since the previous tag; en → plain English, no raw commit ids). Commit it with the bump.
3. **Tag + push**: annotated tag `vX.Y.Z` on the bump commit (or on main where that lands), pushed together with the branch.
4. **Automation**: `.github/workflows/release.yml` fires on every pushed `v*` tag and publishes a GitHub Release using `.github/release-notes/vX.Y.Z.md` as the body. When no notes file exists, it falls back to the tag's annotation message.
5. **Manual fallback**: `gh release create vX.Y.Z --title "Open Expenses vX.Y.Z" --notes-file ...`.

## Versioning scheme

- Semver-ish: `MAJOR.MINOR.PATCH`, currently 0/1 maturity — minor bumps for user-facing features, patch bumps for fixes. Breaking data-model or export-format changes would warrant a major.
- Bumps are dedicated commits, made when a release-worthy change lands on (or ships to) `main`. Feature branches may carry the bump when the tag is cut from them.

## Historical note

- v1.0.0 got a hand-written release; v1.1.0 through v1.4.0 were tagged without releases and backfilled on 2026-09-27 by summarizing git history. Since v1.5.0 every tag has a release.
- Tags v1.0.0–v1.1.0 are annotated; v1.1.1–v1.4.0 are lightweight. New tags must be annotated.

## If the notes file is missing at tag time

Let the workflow's tag-annotation fallback take the release body — but prefer the notes file: the annotation is a one-liner, not release prose. Do not delete or re-push tags to fix a botched release body; edit the release with `gh release edit`.

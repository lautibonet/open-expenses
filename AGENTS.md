# Agents

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` at repo root + `docs/adr/`. See `docs/agents/domain.md`.

### Releases

Version bumps and GitHub Releases tied to `v*` tags, published automatically by CI. Write `.github/release-notes/<tag>.md` before tagging. See `docs/agents/release.md`.

## Language

The code must be in English (e.g., names of methods, variables, constants, etc.). This does not apply to translations into other languages.
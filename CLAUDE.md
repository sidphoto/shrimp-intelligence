# Claude Code Handoff — SharBo Globo

This file is the entry point for the current handoff.

## Read first

1. `AGENTS.md` — non-negotiable data integrity, cutoff, source-authority, Top 5 and publication rules.
2. `docs/CLAUDE_HANDOFF_I18N.md` — current multilingual/localization handoff and acceptance criteria.
3. `AUTOMATION.md` — Tavily/news, market snapshot and GitHub Actions architecture.
4. `i18n.js` — active locale resolver, dictionary loader and localized-content overlay implementation.
5. `scripts/validate_i18n.py` — localization contract and canonical-field safety validator.

## Current project state

The multilingual framework is already implemented and deployed. Do **not** rebuild it from scratch.

Implemented:

- `zh-TW`, `en`, `vi-VN` UI dictionaries.
- locale selection by `?lang=`, localStorage, browser locale, then `zh-TW` fallback.
- language selector, `<html lang>`, localized title/meta description and locale-aware date formatting.
- localized display labels for navigation, filters, market instruments, source classes, severity, categories and regions.
- localized report overlay contract under `data/localized/<locale>/`.
- canonical-machine-field protection in `scripts/validate_i18n.py`.
- `zh-TW` report-content overlay for the current `2026-09-01` report, including all 15 signal titles and `what_happened` summaries.
- Top 5, Today focus, Radar cards and Signal Detail all render the same localized signal objects.

Important: `zh-TW` is now a normal content locale. It is no longer treated as “no overlay required”.

## Current handoff objective

Continue **multilingual content localization and QA** on top of the existing M3/M3.1 implementation.

Primary goals:

1. Ensure visible intelligence content follows the selected locale, not only UI chrome.
2. Complete and quality-check localized content assets for launched locales without introducing any required translation/LLM API.
3. Keep canonical report data immutable and source-grounded.
4. Improve localization coverage validation, stale-overlay protection and responsive behavior where needed.
5. Preserve all existing Tavily, cutoff, source authority, market and publication gates.

## Explicit non-goals

Do not add or require:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- DeepL / Google Translate / other translation API keys
- backend services
- user accounts
- regional editions
- automatic LLM translation as a runtime dependency

Do not redesign the product or replace the existing static-first architecture.

## Data-integrity rule

Localization may change presentation/content wording only. It must never change canonical facts or machine fields such as IDs, scores, source classes, URLs, timestamps, cutoff status, Top 5 membership, verification status, categories/regions slugs or market numeric semantics.

If localization convenience conflicts with data integrity, **data integrity wins**.

## Validation before completion

Run:

```bash
node --check i18n.js
node --check app.js
python -m unittest discover -s tests -v
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
```

Also verify `zh-TW`, `en`, and `vi-VN` manually at desktop and 375px mobile widths.

Report completion with:

- files changed
- localization architecture changes, if any
- content coverage by locale
- fallback behavior
- desktop/mobile QA results
- automated test results
- known untranslated content or residual risks

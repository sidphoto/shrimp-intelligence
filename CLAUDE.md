# Claude Code Handoff — SharBo Globo

Read these files before making changes:

1. `AGENTS.md` — non-negotiable data, cutoff, source-authority and validation rules.
2. `docs/CLAUDE_HANDOFF_I18N.md` — current handoff task: multilingual UI + localization architecture.
3. `AUTOMATION.md` — Tavily/news and market automation architecture.

## Current task

Implement Phase 1 multilingual/localization support for **SharBo Globo｜蝦報全球** without weakening any existing intelligence validation or changing the visual direction unnecessarily.

Phase 1 locales:

- `zh-TW` — canonical/default Traditional Chinese (Taiwan)
- `en` — international English
- `vi-VN` — Vietnamese localized for Taiwan/Vietnam readers

Do not treat localization as literal string replacement. UI localization and intelligence-content localization are separate layers. Preserve canonical machine enums, source URLs, scores, timestamps and verification metadata; localize only presentation/content fields as specified in the handoff document.

Before reporting completion, run:

```bash
python -m unittest discover -s tests -v
python scripts/validate_report.py data/latest.json
```

For front-end changes, also verify all three locales on desktop and mobile widths and ensure no untranslated hard-coded UI strings remain in `app.js` except machine enums / brand names / source names explicitly allowed by the spec.

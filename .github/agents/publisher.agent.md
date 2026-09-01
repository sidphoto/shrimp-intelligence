---
description: "Publish and deploy SharBo Globo only after validation gates pass; preserve last-known-good output on failure."
---
# SharBo Publisher

Publish validated intelligence data and deploy the static site. Do not decide whether weak content should be accepted; Sentinel and deterministic validation decide that.

## Preconditions
```bash
python -m unittest discover -s tests -v
python scripts/validate_report.py data/latest.json
```
Both must pass. For reviewed releases require Sentinel `PASS`.

## Publication rules
- Preserve `data/latest.json` on generation/validation failure.
- Keep immutable `data/YYYY-MM-DD.json` snapshots and sync `data/index.json`.
- Do not rewrite facts/timestamps merely to satisfy validation.
- Do not bypass CI/validation workflows.
- Do not commit secrets.
- Do not redesign the site unless explicitly requested.

Relevant workflows: `.github/workflows/pages.yml`, `daily-radar.yml`, `validation.yml`.
A deployment is successful only when validation, artifact upload, and Pages deploy all succeed.

After publishing report date, data window, signal count, Top 5 IDs, validation result, commit SHA, deployment status/URL, and warnings.

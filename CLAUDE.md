# Claude Code Handoff — SharBo Globo Public Edition

This repository is the source-available **public edition** of SharBo Globo.

## Read first

1. `AGENTS.md` — public repository boundary and validation rules.
2. `AUTOMATION.md` — demo-only CI/deployment model.
3. `i18n.js` — locale resolver and presentation-layer localization.
4. `scripts/validate_i18n.py` — localization contract validator.
5. `scripts/validate_public_repo.py` — production source-data leak gate.

## Non-negotiable public boundary

Do not add production source names, source URLs, source registries, domain allowlists, trust weights, discovery queries, article excerpts, evidence bundles, production archives, market-provider configuration, credentials or private deployment details.

Use only synthetic demo data and `example.invalid` URLs in public fixtures.

## Public project scope

The public repository includes:

- static front-end UI;
- `zh-TW`, `en`, `vi-VN` interface dictionaries;
- deterministic personalization, topic, trend and impact-chain frameworks;
- synthetic demo data;
- public validators and tests.

Production collection, source intelligence, historical corpus and commercial deployment configuration are maintained outside this repository.

## Validation before completion

```bash
node --check i18n.js
node --check app.js
python -m unittest discover -s tests -v
python scripts/validate_public_repo.py
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
```

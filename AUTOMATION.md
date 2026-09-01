# SharBo Globo Public Automation

The public repository intentionally does **not** contain SharBo production collection or publishing automation.

## Public CI responsibilities

Public workflows may only:

1. validate JavaScript and Python syntax;
2. run deterministic unit tests;
3. validate localization contracts;
4. validate the synthetic demo report;
5. run the public source-data leak gate;
6. deploy the synthetic demo to GitHub Pages.

## Explicitly excluded from this repository

- production schedules;
- production source registries or domain allowlists;
- production discovery and verification queries;
- production retrieval/provider configuration;
- production source weighting or trust mapping;
- production daily reports and archives;
- production market-provider configuration;
- production credentials and secrets.

Production automation is maintained separately from this source-available repository.

## Public demo

Run locally:

```bash
python3 -m http.server 8080
```

Validate before contribution:

```bash
python -m unittest discover -s tests -v
python scripts/validate_public_repo.py
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
```

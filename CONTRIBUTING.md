# Contributing to SharBo Globo

SharBo Globo welcomes contributions to the **public source-available edition**. Please read this document before opening a pull request.

## Public repository boundary

Do not submit:

- production source names or source URLs;
- production source registries, domain allowlists, source weights or query strategy;
- real article excerpts or copied publisher content;
- raw retrieval output, candidate pools or evidence bundles;
- production daily reports, archives or localized production reports;
- production market-source configuration;
- API keys, tokens, cookies, credentials or private deployment details;
- confidential or customer-specific material.

Use synthetic data and `https://example.invalid/...` URLs for tests and fixtures.

## Contributor License Agreement

By intentionally submitting a contribution, you agree to [`CLA.md`](CLA.md) for that contribution. The CLA allows the project owner to continue offering the project under both the public noncommercial license and separate commercial licenses while contributors retain ownership of their contributions.

Do not submit a contribution if you do not have authority to accept the CLA.

## Good contribution areas

Public contributions are especially useful for:

- accessibility and responsive UI;
- localization framework and interface translations;
- generic deterministic trend/impact algorithms;
- validators and test coverage;
- synthetic demo scenarios;
- documentation;
- generic schemas and extension points that do not disclose SharBo production source intelligence.

## Development setup

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

Install test dependencies:

```bash
python -m pip install -r requirements.txt
```

Run validation:

```bash
python -m unittest discover -s tests -v
python scripts/validate_public_repo.py
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
node --check app.js
node --check i18n.js
```

## Pull requests

Keep pull requests focused. Explain:

- the user or engineering problem;
- what changed;
- tests added or updated;
- any data-contract implications;
- whether localization keys changed.

The pull request template requires confirmation that no production source intelligence or secrets are included.

## Licensing

Accepted contributions become part of the project under the repository's public license and may also be included in separately licensed commercial editions under the CLA.

See:

- [`LICENSE`](LICENSE)
- [`COMMERCIAL_LICENSE.md`](COMMERCIAL_LICENSE.md)
- [`TRADEMARKS.md`](TRADEMARKS.md)
- [`DATA_POLICY.md`](DATA_POLICY.md)
- [`CLA.md`](CLA.md)

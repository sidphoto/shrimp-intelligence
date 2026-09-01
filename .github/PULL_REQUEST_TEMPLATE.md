## Summary

Describe the public-edition change.

## Public repository safety

- [ ] No production source names or source URLs are included.
- [ ] No article excerpts or production evidence bundles are included.
- [ ] No production source registry, trust weights, domain allowlists, or discovery queries are included.
- [ ] No API keys, tokens, credentials, private endpoints, or customer data are included.
- [ ] Demo URLs use `https://example.invalid/...` only.
- [ ] I have read and agree to the project contribution terms and CLA.

## Validation

- [ ] `python -m unittest discover -s tests -v`
- [ ] `python scripts/validate_public_repo.py`
- [ ] `python scripts/validate_i18n.py`
- [ ] `python scripts/validate_report.py data/latest.json`
- [ ] Relevant JavaScript syntax/regression checks pass.

## Notes

Add screenshots or implementation notes if useful. Do not paste production source material into this PR description.

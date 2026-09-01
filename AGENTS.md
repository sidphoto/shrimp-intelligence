# SharBo Globo Public Repository Agent Rules

This repository is the **source-available public edition** of SharBo Globo.

## Public repository boundary
- Public data must be synthetic demo data only.
- Never commit production source names, source URLs, article excerpts, source registries, trust weights, verification-domain lists, discovery queries, candidate pools, evidence bundles, production archives, or credentials.
- Public fixture URLs must use `https://example.invalid/...`.
- Production source intelligence and production deployment configuration live outside this repository.
- Do not recreate or infer a private source registry from product output.

## Public data contract
- Timezone: `Asia/Taipei`.
- Daily report window model: previous calendar day `00:00` through report day `06:00`.
- Timezone-naive timestamps fail closed.
- Demo `data/latest.json` contains 5–20 synthetic signals.
- `top5_ids` contains exactly 5 existing signal IDs.
- Every Top 5 signal is `window_verified=true` and has at least one synthetic `PRIMARY` or `CONFIRMED` source.
- Source classes are `PRIMARY`, `CONFIRMED`, `ANALYSIS`, `COMMUNITY`, `UNVERIFIED`.

## Engineering boundaries
- Preserve source-authority, cutoff and fail-safe validation semantics.
- Never weaken validation to make tests pass.
- Never hardcode API keys, tokens or credentials.
- Public provider adapters must be generic and must not encode SharBo production source selection or verification strategy.

## Required validation
Before reporting a change as complete, run:

```bash
python -m unittest discover -s tests -v
python scripts/validate_public_repo.py
python scripts/validate_i18n.py
python scripts/validate_report.py data/latest.json
```

## Product architecture
The public repository exposes reusable contracts, UI, deterministic trend/impact logic, localization and validators. Production collection, source intelligence, historical corpus and commercial configuration are proprietary and are not distributed here.

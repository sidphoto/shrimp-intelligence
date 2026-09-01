# SharBo Globo Agent Operating Rules

This repository powers **SharBo Globo｜蝦報全球**, a static-first global intelligence morning brief for a Taiwan-based reader.

## Non-negotiable data contract
- Timezone: `Asia/Taipei`.
- Daily report window: previous calendar day `00:00` through report day `06:00`.
- Anything first available after `06:00` is look-ahead contamination and must not enter that report.
- Timestamps used for cutoff decisions must include an explicit timezone offset. Timezone-naive timestamps fail closed.
- `data/latest.json` must contain 5–20 verified signals.
- `top5_ids` must contain exactly 5 existing signal IDs.
- Every Top 5 signal must be `window_verified=true` and have at least one `PRIMARY` or `CONFIRMED` source.
- Source classes: `PRIMARY`, `CONFIRMED`, `ANALYSIS`, `COMMUNITY`, `UNVERIFIED` only.
- `COMMUNITY` is discovery-only and cannot independently support a major factual claim.
- Do not track or include `三商壽 × 玉山金換股價差` unless the owner explicitly removes this exclusion.
- If generation or validation fails, preserve the last known-good `data/latest.json`.

## Editorial rules
- Prefer official/primary sources, governments, central banks, company announcements, research papers, then Reuters/AP/AFP and high-quality specialist sources.
- Keep roughly 10–20 genuinely useful signals; do not pad.
- Major signals should answer when supported: What happened, Why now, Why important, Who wins/loses, connections, Taiwan impact, What next.
- Build event chains rather than isolated headlines.
- Emerging Signal requires evidence of acceleration across recent days or multiple independent sources.
- Business Transformation: problem → change → measurable outcome → transferable lesson. Never invent metrics.

## Engineering boundaries
- Preserve the existing front-end visual direction unless explicitly asked to change UI.
- Never weaken cutoff, source-authority, Top 5, or fail-safe validators to make tests pass.
- Never hardcode API keys, tokens, or credentials.
- Use repository secrets/variables for runtime credentials and model configuration.

## Required validation
Before reporting a change as complete, run:
```bash
python -m unittest discover -s tests -v
python scripts/validate_report.py data/latest.json
```

## Agent handoff
`Collector → Intelligence → Sentinel → Publisher`
- Collector gathers bounded evidence only.
- Intelligence synthesizes, scores, links impacts, and proposes Top 5.
- Sentinel performs adversarial validation and may block publication.
- Publisher publishes only validated output and must not bypass Sentinel/CI gates.

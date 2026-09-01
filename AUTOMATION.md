# M2 Daily Intelligence Automation

## What this adds

The static site remains unchanged. This layer generates fresh JSON every day and lets the existing GitHub Pages workflow republish the site automatically.

Daily flow:

`Source Registry -> OpenAI Web Search Collector -> Normalizer/Deduper -> Verifier -> Intelligence Scoring -> Event/Impact Linking -> Business Case Analyzer -> CEO/Sentinel -> data/YYYY-MM-DD.json + data/latest.json + data/index.json -> GitHub Pages`

## Schedule

The workflow runs at **06:15 Asia/Taipei** every day. The content cutoff remains strictly fixed at **06:00 Asia/Taipei**.

GitHub Actions cron uses UTC, so the configured schedule is:

```yaml
- cron: "15 22 * * *"
```

## Required secret

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

- `OPENAI_API_KEY` — required to generate new reports.

If this secret is absent, the workflow exits safely and does **not** overwrite `data/latest.json`.

## Optional later

- `TAVILY_API_KEY` — reserved for an additional discovery collector. The M2 pipeline does not depend on it yet.

## Optional repository variables

Repository -> Settings -> Secrets and variables -> Actions -> Variables

- `OPENAI_SEARCH_MODEL` (default `gpt-5.6`)
- `OPENAI_FINAL_MODEL` (default `gpt-5.6`)

## Manual run / backfill

Actions -> Generate daily global intelligence radar -> Run workflow.

You can optionally set `report_date` to `YYYY-MM-DD` to regenerate a historical window.

## Fail-safe behavior

The generator refuses to overwrite `latest.json` when:

- fewer than 5 verified signals survive;
- a Top 5 signal lacks authoritative support;
- a post-cutoff source leaks into the final report;
- an observed time is outside the fixed data window;
- the excluded 三商壽 × 玉山金換股價差 topic appears;
- the API call or structured synthesis fails.

The previous successful report remains online.

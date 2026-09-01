# SharBo Globo Daily Intelligence Automation

## What this adds

The static site remains unchanged. This layer generates fresh JSON every day and lets GitHub Pages republish the site automatically.

Default daily flow:

`Tavily broad discovery -> trusted-source verification sweep -> Source Registry classification -> exact cutoff gate -> URL/event dedupe -> intelligence synthesis -> deterministic verifier -> CEO/Sentinel -> data/YYYY-MM-DD.json + data/latest.json + data/index.json -> GitHub Pages`

Tavily is a **retrieval/discovery provider**, not a truth authority. Its relevance score is never used as a credibility score. SharBo assigns source authority from the source URL/domain and keeps the existing PRIMARY / CONFIRMED / ANALYSIS / COMMUNITY / UNVERIFIED policy.

## Schedule

The workflow runs at **06:15 Asia/Taipei** every day. The content cutoff remains strictly fixed at **06:00 Asia/Taipei**.

GitHub Actions cron uses UTC:

```yaml
- cron: "15 22 * * *"
```

## Required secrets

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

- `OPENAI_API_KEY` — required for structured intelligence synthesis.
- `TAVILY_API_KEY` — required when `NEWS_DISCOVERY_PROVIDER=tavily` (the default).

Secrets are never committed to the public repository. Fork users bring their own keys (BYOK).

## Optional repository variables

Repository -> Settings -> Secrets and variables -> Actions -> Variables

- `NEWS_DISCOVERY_PROVIDER` — default `tavily`; set `openai` only for the legacy web-search collector.
- `TAVILY_PROJECT` — optional Tavily project identifier for usage tracking.
- `TAVILY_DISCOVERY_DEPTH` — default `basic`.
- `TAVILY_VERIFICATION_DEPTH` — default `basic`.
- `TAVILY_DISCOVERY_MAX_RESULTS` — default `12` per sector.
- `TAVILY_VERIFICATION_MAX_RESULTS` — default `8` per trusted-source sweep.
- `TAVILY_MIN_RELEVANCE_SCORE` — default `0.20`; retrieval relevance only.
- `OPENAI_SEARCH_MODEL` — used only by the legacy OpenAI search fallback.
- `OPENAI_FINAL_MODEL` — default `gpt-5.6`.

## Tavily collection strategy

For each sector SharBo performs:

1. **Broad discovery** — Tavily `topic=news`, no trusted-domain restriction, with blocked community domains excluded.
2. **Trusted verification sweep** — a second Tavily search constrained to the sector's existing `allowed_domains`, such as Reuters/AP, governments, central banks, company announcements, research sources, and Taiwan official sources.
3. URL deduplication merges the same result found by both passes and records both collection modes.
4. Tavily `published_date` is normalized only when it has enough temporal precision. SharBo never invents a timezone.
5. Exact post-06:00 timestamps are rejected before synthesis. Date-only metadata on the cutoff day remains `uncertain` and cannot independently prove an in-window claim.
6. The intelligence layer clusters multiple pages into underlying events, then the deterministic verifier re-checks source authority and cutoff integrity before publication.

Tavily's API date filters are only a coarse retrieval guard; the local Asia/Taipei cutoff validator remains authoritative.

## Manual run / backfill

Actions -> SharBo Globo — Generate daily global intelligence radar -> Run workflow.

You can optionally set `report_date` to `YYYY-MM-DD` to regenerate a historical window.

## Fail-safe behavior

The generator refuses to overwrite `latest.json` when:

- Tavily is selected but `TAVILY_API_KEY` is missing;
- fewer than 5 verified signals survive;
- a Top 5 signal lacks authoritative support;
- a post-cutoff source leaks into the final report;
- an observed time is outside the fixed data window;
- timezone-naive timestamps are used as exact cutoff evidence;
- the excluded 三商壽 × 玉山金換股價差 topic appears;
- retrieval, synthesis, or structured validation fails.

The previous successful report remains online.

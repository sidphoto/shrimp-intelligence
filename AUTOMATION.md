# SharBo Globo Daily Intelligence Automation

## Default architecture

The default open-source runtime does not require an OpenAI API key.

`Tavily discovery -> trusted-source verification -> Source Registry -> exact cutoff gate -> event clustering -> deterministic ranking -> reader-facing enrichment -> Sentinel/validator -> data/*.json -> GitHub Pages`

Tavily is a **retrieval/discovery provider**, not a truth authority. Its relevance score is never used as credibility. SharBo assigns authority from the source URL/domain and retains PRIMARY / CONFIRMED / ANALYSIS / COMMUNITY / UNVERIFIED.

## Schedule

SharBo now has two coordinated daily checkpoints in the same workflow:

```yaml
# 05:55 Asia/Taipei — capture market values before the strict cutoff
- cron: "55 21 * * *"

# 06:15 Asia/Taipei — generate and publish the intelligence report
- cron: "15 22 * * *"
```

The intelligence cutoff remains strictly **06:00 Asia/Taipei**.

The 05:55 snapshot prevents look-ahead contamination for instruments that continue trading after 06:00 Taiwan time. The 06:15 report may use only a snapshot captured at or before the cutoff and matching that report date.

## Required secret

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

- `TAVILY_API_KEY` — the only required API secret in the default deterministic mode.

Secrets are never committed to the public repository. Fork users bring their own Tavily key (BYOK).

## Market overview

Market data is separate from news/RSS retrieval. RSS and Tavily remain suitable for news and official-release discovery; numeric market cards use a cutoff-safe structured snapshot instead.

Default no-key sources:

- S&P 500 — Stooq quote snapshot (`^SPX`)
- NASDAQ Composite — Stooq quote snapshot (`^NDQ`)
- USD / TWD — Stooq quote snapshot (`USDTWD`)
- Brent Oil — Stooq continuous Brent quote (`CB.F`)
- Gold — Stooq XAU/USD quote (`XAUUSD`)
- US 30Y — Federal Reserve H.15 data via FRED (`DGS30`)

Stooq quote changes are shown versus the quote's session open. SharBo does not pretend this is a previous-close return. US 30Y uses the latest available official daily observation and change versus the prior available observation.

The snapshot is stored in `data/market-snapshot.json` with `captured_at`. The report loader rejects the file if the report date does not match or if `captured_at` is after 06:00 Asia/Taipei.

If a source is unavailable, that individual metric remains blank; the news report itself can still publish. SharBo never queries live post-cutoff prices merely to fill an empty card.

## OpenAI is optional

The default is:

- `NEWS_DISCOVERY_PROVIDER=tavily`
- `INTELLIGENCE_MODE=deterministic`

This path performs retrieval, source verification, event clustering, ranking, report generation and deterministic validation without `OPENAI_API_KEY`.

A future/optional enhanced mode may set:

- `INTELLIGENCE_MODE=openai`
- `OPENAI_API_KEY=<user supplied key>`

OpenAI is an optional enhancement, not a runtime dependency for the default report.

## Optional repository variables

Repository -> Settings -> Secrets and variables -> Actions -> Variables

- `INTELLIGENCE_MODE` — default `deterministic`; optional `openai`.
- `TAVILY_DISCOVERY_DEPTH` — default `basic`.
- `TAVILY_VERIFICATION_DEPTH` — default `basic`.
- `TAVILY_DISCOVERY_MAX_RESULTS` — default `12` per sector.
- `TAVILY_VERIFICATION_MAX_RESULTS` — default `8` per trusted-source sweep.
- `TAVILY_MIN_RELEVANCE_SCORE` — default `0.20`; retrieval relevance only.
- `OPENAI_FINAL_MODEL` — used only when optional OpenAI intelligence mode is enabled.

## Tavily collection strategy

For each sector SharBo performs:

1. **Broad discovery** — Tavily `topic=news`, without trusted-domain restriction, while community/blocklisted domains are excluded.
2. **Trusted verification sweep** — a second search constrained to each sector's `allowed_domains`, including Reuters/AP, governments, central banks, company announcements, research sources, and Taiwan official sources.
3. URL deduplication merges the same result found by both passes and records collection modes.
4. Source credibility is classified independently from Tavily relevance.
5. Tavily date filtering is only a coarse retrieval guard. Exact Asia/Taipei cutoff logic remains local and authoritative.
6. Exact post-06:00 timestamps are rejected. Timezone-naive/date-only metadata is never promoted to an invented exact timestamp.
7. Deterministic event clustering groups similar headlines and preserves supporting source URLs per event.
8. Top 5 requires at least one PRIMARY or CONFIRMED in-window source. ANALYSIS-only events cannot enter Top 5.

## Reader-facing output

Implementation details belong in logs and repository documentation, not the homepage. The enrichment step removes strings such as `Tavily`, `deterministic`, and `OpenAI API` from the hero summary and replaces them with a reader-facing world-focus sentence derived from the verified Top 5 categories.

## Manual run / backfill

Actions -> SharBo Globo — Daily intelligence radar -> Run workflow.

A manual report run does **not** create a retroactive market snapshot. If no valid pre-06:00 snapshot exists for that date, market cards remain neutral/blank rather than using later prices.

You can optionally set `report_date` to `YYYY-MM-DD` to regenerate a historical intelligence window.

## Fail-safe behavior

The generator refuses to overwrite `latest.json` when:

- `TAVILY_API_KEY` is missing;
- fewer than 5 authoritative in-window events are available for Top 5;
- a Top 5 signal lacks PRIMARY/CONFIRMED support;
- a post-cutoff source leaks into the final report;
- timezone-naive timestamps are used as exact cutoff evidence;
- the excluded 三商壽 × 玉山金換股價差 topic appears;
- retrieval or deterministic validation fails.

Market-source failure does not weaken those rules. The previous successful intelligence report remains online on a blocking failure.

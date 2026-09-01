# SharBo Globo Daily Intelligence Automation

## Default architecture

The default open-source runtime no longer requires an OpenAI API key.

`Tavily broad discovery -> trusted-source verification sweep -> Source Registry classification -> exact cutoff gate -> event clustering -> deterministic ranking/summary -> Sentinel/validator -> data/YYYY-MM-DD.json + data/latest.json + data/index.json -> GitHub Pages`

Tavily is a **retrieval/discovery provider**, not a truth authority. Its relevance score is never used as credibility. SharBo assigns authority from the source URL/domain and retains PRIMARY / CONFIRMED / ANALYSIS / COMMUNITY / UNVERIFIED.

## Schedule

The workflow runs at **06:15 Asia/Taipei** every day. The content cutoff remains strictly fixed at **06:00 Asia/Taipei**.

```yaml
- cron: "15 22 * * *"
```

## Required secret

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

- `TAVILY_API_KEY` — the only required API secret in the default deterministic mode.

Secrets are never committed to the public repository. Fork users bring their own Tavily key (BYOK).

## OpenAI is optional

The default is:

- `NEWS_DISCOVERY_PROVIDER=tavily`
- `INTELLIGENCE_MODE=deterministic`

This path performs retrieval, source verification, event clustering, ranking, report generation and deterministic validation without `OPENAI_API_KEY`.

A future/optional enhanced mode may set:

- `INTELLIGENCE_MODE=openai`
- `OPENAI_API_KEY=<user supplied key>`

OpenAI is therefore an optional enhancement, not a runtime dependency for the default SharBo report.

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
2. **Trusted verification sweep** — a second search constrained to each sector's existing `allowed_domains`, including Reuters/AP, governments, central banks, company announcements, research sources, and Taiwan official sources.
3. URL deduplication merges the same result found by both passes and records the collection modes.
4. Source credibility is classified independently from Tavily relevance.
5. Tavily date filtering is only a coarse retrieval guard. Exact Asia/Taipei cutoff logic remains local and authoritative.
6. Exact post-06:00 timestamps are rejected. Timezone-naive/date-only metadata is never promoted to an invented exact timestamp.
7. Deterministic event clustering groups similar headlines and preserves up to six supporting source URLs per event.
8. Top 5 requires at least one PRIMARY or CONFIRMED in-window source. ANALYSIS-only events cannot enter Top 5.

## What deterministic mode does and does not do

It does:

- collect and verify sources;
- deduplicate and cluster events;
- rank by source authority, independent-domain corroboration and Tavily retrieval relevance;
- generate the website JSON contract;
- enforce the 06:00 cutoff and Top 5 authority rules.

It deliberately does **not** invent unsupported causal analysis, winners/losers, or quantitative market claims. Those fields are conservative until separate structured data providers or an optional LLM intelligence layer are added.

## Manual run / backfill

Actions -> SharBo Globo — Generate daily global intelligence radar -> Run workflow.

You can optionally set `report_date` to `YYYY-MM-DD` to regenerate a historical window.

## Fail-safe behavior

The generator refuses to overwrite `latest.json` when:

- `TAVILY_API_KEY` is missing;
- fewer than 5 authoritative in-window events are available for Top 5;
- a Top 5 signal lacks PRIMARY/CONFIRMED support;
- a post-cutoff source leaks into the final report;
- timezone-naive timestamps are used as exact cutoff evidence;
- the excluded 三商壽 × 玉山金換股價差 topic appears;
- retrieval or deterministic validation fails.

The previous successful report remains online.

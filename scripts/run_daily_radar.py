from __future__ import annotations

import os

import build_report
from tavily_provider import collect_tavily_evidence


def collect_with_tavily(client, registry: dict, start, end):
    # `client` remains part of the build_report collector signature because the
    # downstream intelligence synthesis still uses OpenAI. News retrieval itself
    # is delegated to Tavily here.
    return collect_tavily_evidence(
        registry=registry,
        start=start,
        end=end,
        classify_source=build_report.normalized_source_class,
    )


def main() -> int:
    provider = os.getenv("NEWS_DISCOVERY_PROVIDER", "tavily").strip().lower()
    if provider == "tavily":
        build_report.collect_evidence = collect_with_tavily
    elif provider == "openai":
        # Backward-compatible OSS fallback. The default SharBo deployment uses Tavily.
        print("[provider] using legacy OpenAI web-search collector", flush=True)
    else:
        raise RuntimeError(
            f"Unsupported NEWS_DISCOVERY_PROVIDER={provider!r}; expected 'tavily' or 'openai'"
        )

    return build_report.main()


if __name__ == "__main__":
    raise SystemExit(main())

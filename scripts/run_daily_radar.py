from __future__ import annotations

import os

import build_report
import deterministic_report
from tavily_provider import collect_tavily_evidence


def collect_with_tavily(client, registry: dict, start, end):
    # Used only by the optional OpenAI intelligence mode. News retrieval remains Tavily.
    return collect_tavily_evidence(
        registry=registry,
        start=start,
        end=end,
        classify_source=build_report.normalized_source_class,
    )


def main() -> int:
    provider = os.getenv("NEWS_DISCOVERY_PROVIDER", "tavily").strip().lower()
    mode = os.getenv("INTELLIGENCE_MODE", "deterministic").strip().lower()

    if mode == "deterministic":
        if provider != "tavily":
            raise RuntimeError(
                "INTELLIGENCE_MODE=deterministic currently requires NEWS_DISCOVERY_PROVIDER=tavily"
            )
        return deterministic_report.main()

    if mode == "openai":
        if provider == "tavily":
            build_report.collect_evidence = collect_with_tavily
        elif provider == "openai":
            print("[provider] using legacy OpenAI web-search collector", flush=True)
        else:
            raise RuntimeError(
                f"Unsupported NEWS_DISCOVERY_PROVIDER={provider!r}; expected 'tavily' or 'openai'"
            )
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is required only when INTELLIGENCE_MODE=openai")
        return build_report.main()

    raise RuntimeError(
        f"Unsupported INTELLIGENCE_MODE={mode!r}; expected 'deterministic' or 'openai'"
    )


if __name__ == "__main__":
    raise SystemExit(main())

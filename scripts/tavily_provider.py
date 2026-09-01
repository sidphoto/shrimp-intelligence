from __future__ import annotations

import os
from datetime import datetime, time, timedelta
from typing import Callable, Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

from dateutil import parser as dtparser
from tavily import TavilyClient

TZ = ZoneInfo("Asia/Taipei")


class TavilyConfigurationError(RuntimeError):
    pass


def _domain(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _date_is_fully_inside_window(day, start: datetime, end: datetime) -> bool:
    day_start = datetime.combine(day, time.min, tzinfo=TZ)
    next_day = day_start + timedelta(days=1)
    return start <= day_start and next_day <= end


def normalize_published_date(
    value: Optional[str], start: datetime, end: datetime
) -> tuple[Optional[str], str]:
    """Return (timezone-aware ISO timestamp or None, cutoff status).

    Tavily's news results can expose a full timestamp or date-level metadata.
    Exact timezone-aware timestamps are checked directly. Date-only/naive metadata
    is accepted as in-window only when that entire calendar day is inside the
    SharBo window; otherwise it remains uncertain. We never invent a timezone.
    """
    if not value:
        return None, "uncertain"

    try:
        parsed = dtparser.parse(value)
    except (ValueError, TypeError, OverflowError):
        return None, "uncertain"

    if parsed.tzinfo is not None:
        local = parsed.astimezone(TZ)
        if local < start or local > end:
            return local.isoformat(timespec="seconds"), "out"
        return local.isoformat(timespec="seconds"), "within"

    day = parsed.date()
    if day < start.date() or day > end.date():
        return None, "out"
    if _date_is_fully_inside_window(day, start, end):
        return None, "within"
    return None, "uncertain"


def _query_for_sector(label: str, topics: list[str]) -> str:
    topic_text = "; ".join(topics)
    return (
        f"{label}. Find the most consequential recent developments about: {topic_text}. "
        "Prioritize events with cross-border, systemic, market, technology, supply-chain, "
        "or Taiwan decision impact. Return source pages, not generic topic explainers."
    )


class TavilyNewsProvider:
    """Tavily retrieval layer for SharBo Globo.

    Tavily discovers and ranks pages. It does not decide source authority. Source
    credibility is assigned by SharBo's Source Registry / classifier after retrieval.
    """

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        client=None,
        discovery_depth: str = "basic",
        verification_depth: str = "basic",
        discovery_max_results: int = 12,
        verification_max_results: int = 8,
        min_relevance_score: float = 0.20,
    ) -> None:
        if client is None:
            api_key = api_key or os.getenv("TAVILY_API_KEY")
            if not api_key:
                raise TavilyConfigurationError(
                    "TAVILY_API_KEY is required for NEWS_DISCOVERY_PROVIDER=tavily"
                )
            project_id = os.getenv("TAVILY_PROJECT") or None
            client = TavilyClient(api_key=api_key, project_id=project_id)
        self.client = client
        self.discovery_depth = discovery_depth
        self.verification_depth = verification_depth
        self.discovery_max_results = discovery_max_results
        self.verification_max_results = verification_max_results
        self.min_relevance_score = min_relevance_score

    def _search(
        self,
        *,
        query: str,
        start: datetime,
        end: datetime,
        search_depth: str,
        max_results: int,
        include_domains: Optional[list[str]],
        exclude_domains: list[str],
    ) -> dict:
        # Tavily's absolute filters are date-granular. Widen the coarse API range by
        # one day on each side, then enforce the exact 00:00→06:00 window locally.
        coarse_start = (start.date() - timedelta(days=1)).isoformat()
        coarse_end = (end.date() + timedelta(days=1)).isoformat()
        kwargs = {
            "query": query,
            "topic": "news",
            "search_depth": search_depth,
            "max_results": max_results,
            "include_answer": False,
            "include_raw_content": False,
            "start_date": coarse_start,
            "end_date": coarse_end,
            "exclude_domains": exclude_domains,
        }
        if include_domains:
            kwargs["include_domains"] = include_domains
        return self.client.search(**kwargs)

    def _normalize_result(
        self,
        result: dict,
        *,
        start: datetime,
        end: datetime,
        mode: str,
    ) -> Optional[dict]:
        url = str(result.get("url") or "").strip()
        if not url.startswith(("https://", "http://")):
            return None

        try:
            relevance = float(result.get("score") or 0.0)
        except (TypeError, ValueError):
            relevance = 0.0
        if relevance < self.min_relevance_score:
            return None

        published_raw = result.get("published_date") or result.get("publishedDate")
        published_at, cutoff_status = normalize_published_date(published_raw, start, end)
        if cutoff_status == "out":
            return None

        content = str(result.get("content") or "").strip()
        if len(content) > 1400:
            content = content[:1400] + "…"

        return {
            "title": str(result.get("title") or "Untitled result").strip(),
            "url": url,
            "publisher_domain": _domain(url),
            "content": content,
            "tavily_relevance": round(relevance, 4),
            "published_at": published_at,
            "published_date_raw": published_raw,
            "cutoff_status": cutoff_status,
            "collection_modes": [mode],
        }

    def collect_sector(
        self,
        *,
        sector_key: str,
        spec: dict,
        blocked_domains: list[str],
        start: datetime,
        end: datetime,
    ) -> dict:
        label = spec.get("label") or sector_key
        query = _query_for_sector(label, spec.get("topics") or [])
        allowed_domains = spec.get("allowed_domains") or []

        calls: list[tuple[str, dict]] = []
        discovery = self._search(
            query=query,
            start=start,
            end=end,
            search_depth=self.discovery_depth,
            max_results=self.discovery_max_results,
            include_domains=None,
            exclude_domains=blocked_domains,
        )
        calls.append(("discovery", discovery))

        if allowed_domains:
            verification = self._search(
                query=(
                    "Verify the most consequential developments for this sector using only "
                    f"trusted/first-party sources. {query}"
                ),
                start=start,
                end=end,
                search_depth=self.verification_depth,
                max_results=self.verification_max_results,
                include_domains=allowed_domains,
                exclude_domains=blocked_domains,
            )
            calls.append(("trusted_verification", verification))

        by_url: dict[str, dict] = {}
        raw_count = 0
        for mode, response in calls:
            for raw in response.get("results", []) or []:
                raw_count += 1
                item = self._normalize_result(raw, start=start, end=end, mode=mode)
                if not item:
                    continue
                previous = by_url.get(item["url"])
                if previous:
                    previous["tavily_relevance"] = max(
                        previous["tavily_relevance"], item["tavily_relevance"]
                    )
                    previous["collection_modes"] = sorted(
                        set(previous["collection_modes"] + item["collection_modes"])
                    )
                    if len(item["content"]) > len(previous["content"]):
                        previous["content"] = item["content"]
                    if not previous.get("published_at") and item.get("published_at"):
                        previous["published_at"] = item["published_at"]
                        previous["cutoff_status"] = item["cutoff_status"]
                else:
                    by_url[item["url"]] = item

        items = sorted(
            by_url.values(), key=lambda x: x["tavily_relevance"], reverse=True
        )
        return {
            "sector": sector_key,
            "label": label,
            "query": query,
            "items": items,
            "stats": {
                "api_calls": len(calls),
                "raw_results": raw_count,
                "accepted_results": len(items),
            },
        }


def collect_tavily_evidence(
    *,
    registry: dict,
    start: datetime,
    end: datetime,
    classify_source: Callable[[str, str], str],
) -> list[dict]:
    config = registry.get("tavily", {})
    provider = TavilyNewsProvider(
        discovery_depth=os.getenv(
            "TAVILY_DISCOVERY_DEPTH", config.get("discovery_depth", "basic")
        ),
        verification_depth=os.getenv(
            "TAVILY_VERIFICATION_DEPTH", config.get("verification_depth", "basic")
        ),
        discovery_max_results=int(
            os.getenv(
                "TAVILY_DISCOVERY_MAX_RESULTS",
                str(config.get("discovery_max_results", 12)),
            )
        ),
        verification_max_results=int(
            os.getenv(
                "TAVILY_VERIFICATION_MAX_RESULTS",
                str(config.get("verification_max_results", 8)),
            )
        ),
        min_relevance_score=float(
            os.getenv(
                "TAVILY_MIN_RELEVANCE_SCORE",
                str(config.get("min_relevance_score", 0.20)),
            )
        ),
    )

    evidence: list[dict] = []
    blocked = registry.get("blocked_domains", [])

    for key, spec in registry.get("sectors", {}).items():
        print(f"[tavily] {key}: discovery + trusted verification", flush=True)
        packet = provider.collect_sector(
            sector_key=key,
            spec=spec,
            blocked_domains=blocked,
            start=start,
            end=end,
        )

        sources = []
        memo_lines = [
            "Tavily relevance is retrieval relevance, NOT credibility.",
            "Cluster duplicate pages into underlying events before synthesis.",
            "Prefer trusted_verification items and PRIMARY/CONFIRMED sources for factual anchors.",
        ]
        for index, item in enumerate(packet["items"], 1):
            source_class = classify_source(item["url"], "ANALYSIS")
            item["source_class"] = source_class
            sources.append(
                {
                    "url": item["url"],
                    "title": item["title"],
                    "type": "tavily_news_result",
                    "source_class": source_class,
                    "published_at": item.get("published_at"),
                    "cutoff_status": item["cutoff_status"],
                    "collection_modes": item["collection_modes"],
                }
            )
            memo_lines.extend(
                [
                    f"\n[{index}] {item['title']}",
                    f"source_class={source_class}",
                    f"publisher={item['publisher_domain']}",
                    f"url={item['url']}",
                    f"published_at={item.get('published_at') or 'UNKNOWN'}",
                    f"published_date_raw={item.get('published_date_raw') or 'UNKNOWN'}",
                    f"cutoff_status={item['cutoff_status']}",
                    f"collection_modes={','.join(item['collection_modes'])}",
                    f"tavily_relevance={item['tavily_relevance']} (relevance only)",
                    f"snippet={item['content']}",
                ]
            )

        evidence.append(
            {
                "sector": key,
                "label": packet["label"],
                "provider": "tavily",
                "stats": packet["stats"],
                "memo": "\n".join(memo_lines),
                "sources": sources,
            }
        )

    return evidence

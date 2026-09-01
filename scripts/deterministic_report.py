from __future__ import annotations

import json
import os
import re
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import urlparse

from tavily import TavilyClient

import build_report as core
from tavily_provider import TavilyNewsProvider


SECTOR_META = {
    "global_discovery": {
        "categories": ["world", "global", "policy"],
        "regions": ["global"],
        "why": "可能影響跨國政策、資本流向或全球風險偏好。",
        "taiwan": "若事件進一步影響貿易、能源、金融或科技供應鏈，台灣需持續追蹤其外溢效果。",
    },
    "world_geo": {
        "categories": ["geopolitics", "security"],
        "regions": ["global"],
        "why": "地緣政治與安全事件可能透過能源、航運、制裁、國防與市場風險快速傳導。",
        "taiwan": "可作為台灣觀察灰色地帶、供應鏈韌性與安全風險的外部訊號。",
    },
    "economy_market": {
        "categories": ["economy", "markets", "finance"],
        "regions": ["global", "taiwan"],
        "why": "總體經濟、利率與市場變化會直接影響資金成本、估值與企業投資決策。",
        "taiwan": "可能透過匯率、利率、出口需求與科技股估值傳導至台灣。",
    },
    "ai_tech": {
        "categories": ["ai", "technology", "semiconductor", "developer"],
        "regions": ["global", "taiwan"],
        "why": "AI、開發工具與半導體變化可能改變算力需求、軟體生產力與供應鏈競爭。",
        "taiwan": "台灣位於全球半導體與 AI 硬體供應鏈核心，需關注需求、產能與技術路線變化。",
    },
    "industry_science": {
        "categories": ["industry", "supply-chain", "science"],
        "regions": ["global"],
        "why": "產業、能源、科學與供應鏈訊號可能形成中期成本、產能或政策變化。",
        "taiwan": "若牽涉能源、原物料、製造或科技供應，可能影響台灣企業成本與供應鏈配置。",
    },
    "business_transformation": {
        "categories": ["business", "automation", "productivity"],
        "regions": ["global"],
        "why": "企業營運模式與生產力工具的變化可形成可複製的管理與投資訊號。",
        "taiwan": "可作為台灣企業導入自動化、AI 與流程改善時的外部案例觀察。",
    },
    "taiwan": {
        "categories": ["taiwan", "policy"],
        "regions": ["taiwan"],
        "why": "此事件直接涉及台灣政策、經濟、科技、安全或產業環境。",
        "taiwan": "此事件直接列入 Taiwan Radar，後續以官方公告與獨立可靠來源持續驗證。",
    },
}

AUTHORITY_BASE = {
    "PRIMARY": 88,
    "CONFIRMED": 84,
    "ANALYSIS": 66,
    "COMMUNITY": 50,
    "UNVERIFIED": 40,
}

STOPWORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "as",
    "at", "by", "from", "is", "are", "was", "were", "new", "latest", "update",
}


def _domain(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def _tokens(title: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]{2,}", title.lower())
    return {w for w in words if w not in STOPWORDS and len(w) > 1}


def title_similarity(a: str, b: str) -> float:
    a_norm = re.sub(r"\W+", " ", a.lower()).strip()
    b_norm = re.sub(r"\W+", " ", b.lower()).strip()
    seq = SequenceMatcher(None, a_norm, b_norm).ratio()
    ta, tb = _tokens(a), _tokens(b)
    jac = len(ta & tb) / len(ta | tb) if ta and tb else 0.0
    return max(seq, jac)


def _clean_snippet(text: str, fallback: str) -> str:
    value = re.sub(r"\s+", " ", (text or fallback).strip())
    if len(value) > 520:
        value = value[:517].rstrip() + "…"
    return value


def _source_class(item: dict) -> str:
    return core.normalized_source_class(item.get("url", ""), "ANALYSIS")


def collect_packets(registry: dict, start: datetime, end: datetime) -> list[dict]:
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise RuntimeError("TAVILY_API_KEY is required for deterministic Tavily mode")

    # Keep construction aligned with Tavily's documented Python SDK surface.
    provider = TavilyNewsProvider(
        client=TavilyClient(api_key=api_key),
        discovery_depth=os.getenv(
            "TAVILY_DISCOVERY_DEPTH", registry.get("tavily", {}).get("discovery_depth", "basic")
        ),
        verification_depth=os.getenv(
            "TAVILY_VERIFICATION_DEPTH", registry.get("tavily", {}).get("verification_depth", "basic")
        ),
        discovery_max_results=int(
            os.getenv(
                "TAVILY_DISCOVERY_MAX_RESULTS",
                str(registry.get("tavily", {}).get("discovery_max_results", 12)),
            )
        ),
        verification_max_results=int(
            os.getenv(
                "TAVILY_VERIFICATION_MAX_RESULTS",
                str(registry.get("tavily", {}).get("verification_max_results", 8)),
            )
        ),
        min_relevance_score=float(
            os.getenv(
                "TAVILY_MIN_RELEVANCE_SCORE",
                str(registry.get("tavily", {}).get("min_relevance_score", 0.20)),
            )
        ),
    )

    packets: list[dict] = []
    blocked = registry.get("blocked_domains", [])
    for sector_key, spec in registry.get("sectors", {}).items():
        print(f"[tavily] {sector_key}: discovery + source verification", flush=True)
        packet = provider.collect_sector(
            sector_key=sector_key,
            spec=spec,
            blocked_domains=blocked,
            start=start,
            end=end,
        )
        for item in packet.get("items", []):
            item["source_class"] = _source_class(item)
            item["sector"] = sector_key
        packets.append(packet)
    return packets


def cluster_events(packets: list[dict], threshold: float = 0.62) -> list[dict]:
    flat: list[dict] = []
    for packet in packets:
        for item in packet.get("items", []):
            if item.get("cutoff_status") == "out":
                continue
            flat.append(dict(item))

    flat.sort(
        key=lambda x: (
            core.source_rank(x.get("source_class", "ANALYSIS")),
            float(x.get("tavily_relevance") or 0),
        ),
        reverse=True,
    )

    clusters: list[dict] = []
    for item in flat:
        placed = False
        for cluster in clusters:
            if title_similarity(item.get("title", ""), cluster["title"]) >= threshold:
                cluster["items"].append(item)
                # Prefer the title from the stronger source; then higher Tavily relevance.
                current = cluster["representative"]
                if (
                    core.source_rank(item.get("source_class", "ANALYSIS")),
                    float(item.get("tavily_relevance") or 0),
                ) > (
                    core.source_rank(current.get("source_class", "ANALYSIS")),
                    float(current.get("tavily_relevance") or 0),
                ):
                    cluster["representative"] = item
                    cluster["title"] = item.get("title", cluster["title"])
                placed = True
                break
        if not placed:
            clusters.append({"title": item.get("title", "Untitled"), "representative": item, "items": [item]})
    return clusters


def _event_score(cluster: dict) -> int:
    items = cluster["items"]
    strongest = max((core.source_rank(i.get("source_class", "ANALYSIS")) for i in items), default=1)
    strongest_class = max(
        (i.get("source_class", "ANALYSIS") for i in items),
        key=core.source_rank,
        default="ANALYSIS",
    )
    relevance = max((float(i.get("tavily_relevance") or 0) for i in items), default=0.0)
    domains = {_domain(i.get("url", "")) for i in items if _domain(i.get("url", ""))}
    trusted_sweep = any("trusted_verification" in (i.get("collection_modes") or []) for i in items)
    within = any(i.get("cutoff_status") == "within" for i in items)

    score = AUTHORITY_BASE.get(strongest_class, 40)
    score += min(7, round(relevance * 7))
    score += min(9, max(0, len(domains) - 1) * 3)
    if trusted_sweep:
        score += 3
    if not within:
        score = min(score, 69)
    if strongest < core.source_rank("CONFIRMED"):
        score = min(score, 79)
    return max(0, min(99, score))


def cluster_to_signal(cluster: dict, report_date) -> dict | None:
    items = cluster["items"]
    representative = cluster["representative"]
    title = cluster.get("title") or representative.get("title") or "Untitled signal"
    if core.excluded_topic(title):
        return None

    # Deduplicate source URLs inside the event bundle.
    by_url: dict[str, dict] = {}
    for item in items:
        url = item.get("url") or ""
        if not url:
            continue
        previous = by_url.get(url)
        if not previous or core.source_rank(item.get("source_class", "ANALYSIS")) > core.source_rank(
            previous.get("source_class", "ANALYSIS")
        ):
            by_url[url] = item

    sources = []
    for item in sorted(
        by_url.values(),
        key=lambda x: (
            core.source_rank(x.get("source_class", "ANALYSIS")),
            float(x.get("tavily_relevance") or 0),
        ),
        reverse=True,
    )[:6]:
        source_class = item.get("source_class") or _source_class(item)
        sources.append(
            {
                "class": source_class,
                "name": _domain(item.get("url", "")) or "source",
                "url": item.get("url", ""),
                "published_at": item.get("published_at"),
                "cutoff_status": item.get("cutoff_status", "uncertain"),
                "note": "Tavily discovery" + (
                    " + trusted-source verification"
                    if "trusted_verification" in (item.get("collection_modes") or [])
                    else ""
                ),
            }
        )

    if not sources:
        return None

    strongest_class = max((s["class"] for s in sources), key=core.source_rank)
    authoritative_within = any(
        s["class"] in ("PRIMARY", "CONFIRMED") and s.get("cutoff_status") == "within"
        for s in sources
    )
    sectors = [i.get("sector") for i in items if i.get("sector")]
    primary_sector = representative.get("sector") or (sectors[0] if sectors else "global_discovery")
    meta = SECTOR_META.get(primary_sector, SECTOR_META["global_discovery"])

    domains = []
    for src in sources:
        if src["name"] not in domains:
            domains.append(src["name"])
    source_label = " + ".join(domains[:3])

    score = _event_score(cluster)
    snippet = _clean_snippet(representative.get("content", ""), title)
    distinct_domains = len(set(domains))
    trusted_hits = sum(
        1 for i in items if "trusted_verification" in (i.get("collection_modes") or [])
    )

    categories = list(dict.fromkeys(meta["categories"]))
    regions = list(dict.fromkeys(meta["regions"]))
    if "taiwan" in sectors and "taiwan" not in regions:
        regions.append("taiwan")

    return {
        "id": core.stable_signal_id(report_date, title),
        "title": title,
        "score": score,
        "source_class": strongest_class,
        "source_label": source_label,
        "categories": categories,
        "regions": regions,
        "what_happened": snippet,
        "why_now": (
            f"此事件出現在本期資料窗內；目前彙整 {distinct_domains} 個不同來源，"
            f"其中 {trusted_hits} 筆來自既有可信來源名單的驗證搜尋。"
        ),
        "why_important": meta["why"],
        "winners_losers": "Deterministic 模式不對受益者或受損者做未經來源支持的推論。",
        "taiwan_impact": meta["taiwan"],
        "what_next": "持續追蹤原始官方來源、第二獨立可靠來源與後續可量化資料。",
        "impact_chain": [],
        "sources": sources,
        "observed_at": None,
        "window_verified": authoritative_within,
        "emerging_signal": False,
        "emerging_reason": "",
        "quality_note": (
            "Tavily-only deterministic mode; relevance score is not treated as credibility. "
            f"event_sources={len(sources)}"
        ),
    }


def build_deterministic_report(packets: list[dict], report_date, start: datetime, end: datetime) -> dict:
    clusters = cluster_events(packets)
    candidates = []
    for cluster in clusters:
        signal = cluster_to_signal(cluster, report_date)
        if signal:
            candidates.append(signal)

    candidates.sort(
        key=lambda x: (
            x["score"],
            core.source_rank(x["source_class"]),
            x["window_verified"],
        ),
        reverse=True,
    )

    top5 = [
        s for s in candidates
        if s.get("window_verified")
        and any(src.get("class") in ("PRIMARY", "CONFIRMED") for src in s.get("sources", []))
    ][:5]
    if len(top5) < 5:
        raise RuntimeError(
            f"Only {len(top5)} authoritative in-window events available; refusing to publish"
        )

    top_ids = {s["id"] for s in top5}
    remaining = [s for s in candidates if s["id"] not in top_ids]
    signals = (top5 + remaining)[: core.MAX_SIGNALS]
    if len(signals) < core.MIN_VALID_SIGNALS:
        raise RuntimeError(
            f"Only {len(signals)} events survived deterministic verification; refusing to publish"
        )

    top_sectors = []
    for signal in top5:
        label = signal["categories"][0] if signal.get("categories") else "world"
        if label not in top_sectors:
            top_sectors.append(label)
    world_summary = (
        f"本期以 Tavily 廣域搜尋與既有可信來源驗證後，彙整 {len(signals)} 項事件；"
        f"Top 5 主要集中於 {', '.join(top_sectors[:4])}。"
        "此版本採 deterministic 模式，不使用 OpenAI API。"
    )

    uncertain = sum(1 for x in signals if not x.get("window_verified"))
    grade = "A" if uncertain == 0 else "A-" if uncertain <= 2 else "B"
    critical = sum(1 for x in signals if x["score"] >= 95)
    important = sum(1 for x in signals if 85 <= x["score"] < 95)

    taiwan_radar = []
    for signal in signals:
        if "taiwan" in signal.get("regions", []):
            impact = signal.get("taiwan_impact", "")
            if impact and impact not in taiwan_radar:
                taiwan_radar.append(impact)
            if len(taiwan_radar) >= 4:
                break

    return {
        "date": report_date.isoformat(),
        "generated_at": datetime.now(core.TZ).isoformat(timespec="seconds"),
        "engine_version": "m2.4-tavily-deterministic-v1",
        "window": {
            "start": start.strftime("%Y-%m-%d %H:%M"),
            "end": end.strftime("%Y-%m-%d %H:%M"),
            "timezone": "Asia/Taipei",
        },
        "world_summary": world_summary,
        "counts": {"critical": critical, "important": important, "emerging": 0},
        "quality": {
            "window_verified": all(x.get("window_verified") for x in top5),
            "grade": grade,
            "notes": [
                "Tavily is retrieval/discovery; credibility is assigned by SharBo source rules.",
                "No OpenAI API was used for synthesis.",
                "Top 5 requires PRIMARY/CONFIRMED in-window support.",
            ],
        },
        "top5_ids": [x["id"] for x in top5],
        "signals": signals,
        "emerging_signals": [],
        "impact_chain": [],
        "topic_summary": core.build_topic_summary(signals),
        "market": [
            {"name": name, "value": "—", "change": "未接結構化市場資料 API", "direction": "flat"}
            for name in ["S&P 500", "NASDAQ", "USD / TWD", "Brent Oil", "Gold", "US 30Y"]
        ],
        "taiwan_radar": taiwan_radar,
        "business_cases": [],
    }


def main() -> int:
    now = datetime.now(core.TZ)
    report_date = core.compute_report_date(now)
    start, end = core.build_window(report_date)
    if now < end and not os.getenv("REPORT_DATE"):
        print(f"[skip] Window has not closed yet. Cutoff is {core.iso_taipei(end)}")
        return 0

    registry = core.load_json(core.CONFIG_DIR / "sources.json")
    print(f"[mode] Tavily-only deterministic intelligence", flush=True)
    print(f"[window] {core.iso_taipei(start)} -> {core.iso_taipei(end)}", flush=True)

    packets = collect_packets(registry, start, end)
    core.TMP_DIR.mkdir(parents=True, exist_ok=True)
    (core.TMP_DIR / "evidence.json").write_text(
        json.dumps(packets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    report = build_deterministic_report(packets, report_date, start, end)
    core.atomic_publish(report)
    print(
        f"[done] {report_date}: {len(report['signals'])} signals, "
        f"quality={report['quality']['grade']}, top5={report['top5_ids']}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

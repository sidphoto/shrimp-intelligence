from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from dateutil import parser as dtparser
from openai import OpenAI
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CONFIG_DIR = ROOT / "config"
PROMPTS_DIR = ROOT / "prompts"
TMP_DIR = ROOT / ".tmp" / "radar"
TZ = ZoneInfo("Asia/Taipei")

SEARCH_MODEL = os.getenv("OPENAI_SEARCH_MODEL", "gpt-5.6")
FINAL_MODEL = os.getenv("OPENAI_FINAL_MODEL", "gpt-5.6")
MAX_SIGNALS = int(os.getenv("RADAR_MAX_SIGNALS", "20"))
MIN_VALID_SIGNALS = int(os.getenv("RADAR_MIN_VALID_SIGNALS", "5"))

SourceClass = Literal["PRIMARY", "CONFIRMED", "ANALYSIS", "COMMUNITY", "UNVERIFIED"]
CutoffStatus = Literal["within", "uncertain"]


class Window(BaseModel):
    start: str
    end: str
    timezone: str = "Asia/Taipei"


class Source(BaseModel):
    source_class: SourceClass
    name: str
    url: str
    published_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp with timezone offset if known, e.g. 2026-09-01T04:30:00+08:00",
    )
    cutoff_status: CutoffStatus
    note: str = ""


class ImpactNode(BaseModel):
    icon: str = "•"
    label: str


class BusinessCase(BaseModel):
    company_or_case: str
    problem: str
    change: str
    measurable_outcome: str
    transferable_lesson: str


class SignalDraft(BaseModel):
    title: str
    score: int = Field(ge=0, le=100)
    source_class: SourceClass
    source_label: str
    categories: list[str]
    regions: list[str]
    what_happened: str
    why_now: str
    why_important: str
    winners_losers: str
    taiwan_impact: str
    what_next: str
    impact_chain: list[ImpactNode] = Field(default_factory=list)
    sources: list[Source]
    observed_at: Optional[str] = Field(
        default=None,
        description="ISO 8601 timestamp with timezone offset when this signal was observable, if known",
    )
    window_verified: bool
    emerging_signal: bool = False
    emerging_reason: str = ""
    quality_note: str = ""
    business_case: Optional[BusinessCase] = None


class MarketDraft(BaseModel):
    name: str
    value: str
    change: str
    direction: Literal["up", "down", "flat"] = "flat"
    as_of: Optional[str] = Field(default=None, description="ISO 8601 timestamp with timezone offset if known")
    source_url: Optional[str] = None
    cutoff_status: CutoffStatus = "uncertain"


class RadarDraft(BaseModel):
    world_summary: str
    signals: list[SignalDraft]
    market: list[MarketDraft] = Field(default_factory=list)
    data_quality_notes: list[str] = Field(default_factory=list)


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def compute_report_date(now: datetime) -> date:
    forced = os.getenv("REPORT_DATE")
    if forced:
        return date.fromisoformat(forced)
    local_now = now.astimezone(TZ)
    # A manual run before the 06:00 cutoff should generate the most recently closed window.
    if local_now.time() < time(6, 0):
        return local_now.date() - timedelta(days=1)
    return local_now.date()


def build_window(report_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(report_date - timedelta(days=1), time(0, 0), TZ)
    end = datetime.combine(report_date, time(6, 0), TZ)
    return start, end


def iso_taipei(dt: datetime) -> str:
    return dt.astimezone(TZ).isoformat(timespec="minutes")


def parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = dtparser.isoparse(value)
    except (ValueError, TypeError):
        return None
    if parsed.tzinfo is None:
        raise ValueError(f"Timestamp is missing timezone offset: {value}")
    return parsed.astimezone(TZ)



PRIMARY_DOMAIN_SUFFIXES = (
    "un.org", "nato.int", "state.gov", "defense.gov", "whitehouse.gov",
    "consilium.europa.eu", "ec.europa.eu", "gov.uk", "mofa.go.jp", "mfa.gov.cn",
    "federalreserve.gov", "treasury.gov", "bls.gov", "bea.gov", "ecb.europa.eu",
    "boj.or.jp", "imf.org", "worldbank.org", "bis.org", "openai.com", "anthropic.com",
    "deepmind.google", "blog.google", "nvidia.com", "github.blog", "github.com",
    "huggingface.co", "arxiv.org", "tsmc.com", "intel.com", "amd.com", "microsoft.com",
    "about.meta.com", "aws.amazon.com", "nasa.gov", "who.int", "nih.gov", "iea.org",
    "eia.gov", "gov.tw", "president.gov.tw", "mnd.gov.tw", "moea.gov.tw", "cbc.gov.tw",
    "ndc.gov.tw", "twse.com.tw"
)
WIRE_DOMAIN_SUFFIXES = ("reuters.com", "apnews.com")


def source_domain(url: str) -> str:
    from urllib.parse import urlparse
    try:
        return (urlparse(url).hostname or "").lower()
    except Exception:
        return ""


def normalized_source_class(url: str, proposed: str) -> str:
    domain = source_domain(url)
    if any(domain == d or domain.endswith("." + d) for d in WIRE_DOMAIN_SUFFIXES):
        return "CONFIRMED"
    if any(domain == d or domain.endswith("." + d) for d in PRIMARY_DOMAIN_SUFFIXES):
        return "PRIMARY"
    return proposed

def source_rank(source_class: str) -> int:
    return {
        "PRIMARY": 5,
        "CONFIRMED": 4,
        "ANALYSIS": 3,
        "COMMUNITY": 2,
        "UNVERIFIED": 1,
    }.get(source_class, 0)


def excluded_topic(text: str) -> bool:
    normalized = re.sub(r"\s+", "", text)
    return "換股價差" in normalized or (
        ("三商壽" in normalized or "三商美邦" in normalized) and "玉山金" in normalized
    )


def stable_signal_id(report_date: date, title: str) -> str:
    digest = hashlib.sha1(title.encode("utf-8")).hexdigest()[:9]
    return f"{report_date.strftime('%Y%m%d')}-{digest}"


def extract_urls_from_response(response) -> list[dict]:
    """Extract citation/source URLs without depending on private SDK internals."""
    try:
        payload = response.model_dump(mode="json")
    except Exception:
        return []

    found: dict[str, dict] = {}

    def walk(obj):
        if isinstance(obj, dict):
            url = obj.get("url")
            if isinstance(url, str) and url.startswith(("http://", "https://")):
                found.setdefault(
                    url,
                    {
                        "url": url,
                        "title": obj.get("title") or obj.get("name") or "",
                        "type": obj.get("type") or "source",
                    },
                )
            for value in obj.values():
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(payload)
    return list(found.values())


def sector_prompt(label: str, topics: list[str], start: datetime, end: datetime) -> str:
    topics_text = "\n".join(f"- {x}" for x in topics)
    return f"""
You are collecting evidence for a bounded global intelligence morning brief.

ABSOLUTE DATA WINDOW (Asia/Taipei):
START: {iso_taipei(start)}
CUTOFF: {iso_taipei(end)}
Equivalent cutoff UTC: {end.astimezone(ZoneInfo('UTC')).isoformat(timespec='minutes')}

Sector: {label}
Coverage priorities:
{topics_text}

Search for developments that happened, were published, or became reliably observable inside this window only.
Do not use information first published or first observable after the cutoff, even if it is available to you now.
Prefer official primary sources, governments, central banks, company announcements, research papers, Reuters/AP/AFP and high-quality specialist sources.
Social/community sources may be used only to discover a lead; do not treat them as factual support.
For each candidate event, explicitly state:
- concise event description
- source / publisher
- source URL
- publication timestamp WITH timezone when the page makes it available
- if exact publication time is unavailable, say TIME UNCERTAIN; do not guess
- why the event may have global chain effects, Taiwan relevance, or decision value
- any connected event or downstream impact

Return a compact evidence memo with citations. Avoid low-value filler and duplicated stories.
""".strip()


def collect_evidence(client: OpenAI, registry: dict, start: datetime, end: datetime) -> list[dict]:
    evidence: list[dict] = []
    blocked = registry.get("blocked_domains", [])

    for key, spec in registry["sectors"].items():
        filters: dict = {"blocked_domains": blocked}
        allowed = spec.get("allowed_domains") or []
        if allowed:
            filters["allowed_domains"] = allowed

        tool = {
            "type": "web_search",
            "search_context_size": spec.get("search_context_size", "medium"),
            "filters": filters,
        }
        prompt = sector_prompt(spec["label"], spec.get("topics", []), start, end)
        print(f"[collect] {key}: {spec['label']}", flush=True)
        response = client.responses.create(
            model=SEARCH_MODEL,
            reasoning={"effort": "low"},
            tools=[tool],
            tool_choice="auto",
            include=["web_search_call.action.sources"],
            input=prompt,
        )
        evidence.append(
            {
                "sector": key,
                "label": spec["label"],
                "memo": response.output_text,
                "sources": extract_urls_from_response(response),
            }
        )

    return evidence


def synthesize(client: OpenAI, evidence: list[dict], start: datetime, end: datetime, profile: dict) -> RadarDraft:
    system_prompt = (PROMPTS_DIR / "daily_radar.md").read_text(encoding="utf-8")
    compact_evidence = json.dumps(evidence, ensure_ascii=False)
    profile_text = json.dumps(profile, ensure_ascii=False)
    user_prompt = f"""
REPORT DATE: {end.date().isoformat()}
WINDOW START: {iso_taipei(start)}
WINDOW CUTOFF: {iso_taipei(end)}
EDITORIAL PROFILE: {profile_text}

EVIDENCE PACKET:
{compact_evidence}

Produce the structured daily radar now. Use only URLs present in the evidence packet. Source published_at and observed_at must be ISO 8601 with an explicit timezone offset when known. If unknown, use null and cutoff_status='uncertain'.
""".strip()

    print("[synthesize] CEO + Sentinel structured pass", flush=True)
    response = client.responses.parse(
        model=FINAL_MODEL,
        input=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        text_format=RadarDraft,
    )
    if response.output_parsed is None:
        raise RuntimeError("Structured output was empty")
    return response.output_parsed


def verify_and_normalize(draft: RadarDraft, report_date: date, start: datetime, end: datetime) -> tuple[list[dict], list[str]]:
    accepted: list[dict] = []
    notes: list[str] = list(draft.data_quality_notes)

    for signal in draft.signals:
        if excluded_topic(signal.title + " " + signal.what_happened):
            notes.append(f"Excluded configured topic: {signal.title}")
            continue

        try:
            observed = parse_time(signal.observed_at)
        except ValueError as exc:
            notes.append(f"Rejected invalid timestamp on '{signal.title}': {exc}")
            continue
        if observed and not (start <= observed <= end):
            notes.append(f"Dropped look-ahead/out-of-window signal: {signal.title}")
            continue

        valid_sources: list[Source] = []
        has_in_window_anchor = False
        has_authoritative_anchor = False

        for src in signal.sources:
            try:
                published = parse_time(src.published_at)
            except ValueError as exc:
                notes.append(f"Rejected invalid source timestamp for '{signal.title}' ({src.name}): {exc}")
                continue
            if published and published > end:
                notes.append(f"Removed post-cutoff source from '{signal.title}': {src.name}")
                continue
            valid_sources.append(src)
            if src.cutoff_status == "within":
                # The evidence pass is explicitly cutoff-bounded. If an exact timestamp exists,
                # it was checked above; if a page exposes only date-level metadata, retain the
                # model's conservative in-window classification rather than inventing a time.
                has_in_window_anchor = True
                effective_class = normalized_source_class(src.url, src.source_class)
                if effective_class in ("PRIMARY", "CONFIRMED"):
                    has_authoritative_anchor = True

        if not valid_sources:
            notes.append(f"Dropped signal without valid sources: {signal.title}")
            continue

        # Conservative scoring caps when timing or authority is weaker.
        score = signal.score
        window_verified = bool(signal.window_verified and (has_in_window_anchor or observed is not None))
        if not window_verified:
            score = min(score, 79)
        if not has_authoritative_anchor:
            score = min(score, 79)
        if signal.source_class in ("COMMUNITY", "UNVERIFIED"):
            score = min(score, 69)

        sources_json = []
        for src in valid_sources:
            sources_json.append(
                {
                    "class": normalized_source_class(src.url, src.source_class),
                    "name": src.name,
                    "url": src.url,
                    "published_at": src.published_at,
                    "cutoff_status": src.cutoff_status,
                    "note": src.note,
                }
            )

        effective_classes = [normalized_source_class(src.url, src.source_class) for src in valid_sources]
        overall_class = max(effective_classes, key=source_rank) if effective_classes else signal.source_class

        item = {
            "id": stable_signal_id(report_date, signal.title),
            "title": signal.title,
            "score": score,
            "source_class": overall_class,
            "source_label": signal.source_label,
            "categories": signal.categories,
            "regions": signal.regions,
            "what_happened": signal.what_happened,
            "why_now": signal.why_now,
            "why_important": signal.why_important,
            "winners_losers": signal.winners_losers,
            "taiwan_impact": signal.taiwan_impact,
            "what_next": signal.what_next,
            "impact_chain": [node.model_dump() for node in signal.impact_chain],
            "sources": sources_json,
            "observed_at": signal.observed_at,
            "window_verified": window_verified,
            "emerging_signal": signal.emerging_signal,
            "emerging_reason": signal.emerging_reason,
            "quality_note": signal.quality_note,
        }
        if signal.business_case:
            item["business_case"] = signal.business_case.model_dump()
        accepted.append(item)

    # Deduplicate by normalized title, then rank by importance and source authority.
    deduped: dict[str, dict] = {}
    for item in accepted:
        key = re.sub(r"[^\w\u4e00-\u9fff]+", "", item["title"].lower())[:80]
        previous = deduped.get(key)
        if not previous or (item["score"], source_rank(item["source_class"])) > (
            previous["score"],
            source_rank(previous["source_class"]),
        ):
            deduped[key] = item

    ranked = sorted(
        deduped.values(),
        key=lambda x: (x["score"], source_rank(x["source_class"]), x["window_verified"]),
        reverse=True,
    )[:MAX_SIGNALS]

    if len(ranked) < MIN_VALID_SIGNALS:
        raise RuntimeError(
            f"Only {len(ranked)} valid signals survived verification; refusing to overwrite latest.json"
        )

    return ranked, notes


TOPIC_BUCKETS = [
    ("全球要聞", "World News", "🌐", "#2f86dd", {"world", "global", "politics", "policy"}),
    ("地緣政治", "Geopolitics", "🏛️", "#ef6b6a", {"geopolitics", "defense", "security", "military"}),
    ("經濟與市場", "Economy & Markets", "📈", "#2ea66f", {"economy", "markets", "finance", "trade"}),
    ("AI 模型", "AI Models", "🧠", "#8f68d8", {"ai", "ai-model", "models"}),
    ("開發與開源", "Dev & Open Source", "⌘", "#7d72d9", {"agent", "developer", "github", "open-source"}),
    ("科技與半導體", "Tech & Semiconductor", "💾", "#2a9bb0", {"technology", "semiconductor", "ai-infrastructure"}),
    ("產業與供應鏈", "Supply Chain", "🏭", "#e38a2a", {"industry", "supply-chain", "logistics"}),
    ("能源與原物料", "Energy & Commodities", "💧", "#ed9a35", {"energy", "commodities", "oil", "lng"}),
    ("科學與氣候", "Science & Climate", "🧪", "#67a65b", {"science", "research", "biotech", "space", "climate"}),
    ("商業變革", "Business Transform", "🏢", "#d65b98", {"business", "automation", "operations", "productivity"}),
    ("社會趨勢", "Society", "👥", "#3c86d7", {"society", "population", "migration", "labor"}),
    ("台灣相關", "Taiwan", "🇹🇼", "#22a8bc", {"taiwan"}),
]


def build_topic_summary(signals: list[dict]) -> list[dict]:
    rows = []
    for zh, en, icon, color, keys in TOPIC_BUCKETS:
        count = 0
        for signal in signals:
            cats = {str(x).lower() for x in signal.get("categories", [])}
            regs = {str(x).lower() for x in signal.get("regions", [])}
            if keys & (cats | regs):
                count += 1
        rows.append({"zh": zh, "en": en, "icon": icon, "count": count, "color": color})
    return rows


def load_historical_reports(current_date: str, limit: int = 14) -> list[dict]:
    reports = []
    for path in sorted(DATA_DIR.glob("20??-??-??.json"), reverse=True):
        if path.stem >= current_date:
            continue
        try:
            reports.append(load_json(path))
        except Exception:
            continue
        if len(reports) >= limit:
            break
    return list(reversed(reports))


def build_emerging_cards(signals: list[dict], report_date: str) -> list[dict]:
    historical = load_historical_reports(report_date, limit=14)
    cards = []
    icons = {"geopolitics": "🌍", "energy": "⚓", "ai": "🤖", "agent": "🤖", "semiconductor": "🧠", "economy": "📈", "markets": "📈", "technology": "💻", "business": "🏢", "climate": "🌦️", "security": "🛡️"}
    for signal in [x for x in signals if x.get("emerging_signal")][:5]:
        categories = [str(x).lower() for x in signal.get("categories", [])]
        key = categories[0] if categories else "world"
        series = []
        for report in historical:
            count = sum(1 for old in report.get("signals", []) if key in {str(c).lower() for c in old.get("categories", [])})
            series.append(count)
        series.append(sum(1 for cur in signals if key in {str(c).lower() for c in cur.get("categories", [])}))
        while len(series) < 8:
            series.insert(0, 0)
        prev = sum(series[:-7]) if len(series) > 7 else 0
        recent = sum(series[-7:])
        change = round(((recent - prev) / max(prev, 1)) * 100) if prev or recent else 0
        cards.append({
            "name": key.replace("-", " ").title(),
            "label": signal["title"][:28],
            "icon": icons.get(key, "↗"),
            "change": max(change, 0),
            "reason": signal.get("emerging_reason") or signal.get("why_important", ""),
            "series": series[-15:],
        })
    return cards


def build_market(draft: RadarDraft, end: datetime) -> list[dict]:
    preferred = ["S&P 500", "NASDAQ", "USD / TWD", "Brent Oil", "Gold", "US 30Y"]
    by_name = {m.name.lower(): m for m in draft.market}
    result = []
    for name in preferred:
        metric = by_name.get(name.lower())
        if not metric:
            result.append({"name": name, "value": "—", "change": "資料窗內未取得可靠值", "direction": "flat"})
            continue
        try:
            as_of = parse_time(metric.as_of)
        except ValueError:
            as_of = None
        valid = metric.cutoff_status == "within" and (as_of is None or as_of <= end)
        result.append({
            "name": name,
            "value": metric.value if valid else "—",
            "change": metric.change if valid else "時間未驗證",
            "direction": metric.direction if metric.direction in ("up", "down") else "flat",
            "as_of": metric.as_of,
            "source_url": metric.source_url,
        })
    return result


def build_taiwan_radar(signals: list[dict]) -> list[str]:
    items = []
    for signal in signals:
        impact = (signal.get("taiwan_impact") or "").strip()
        if not impact:
            continue
        if impact not in items:
            items.append(impact)
        if len(items) >= 4:
            break
    return items


def build_business_cases(signals: list[dict]) -> list[dict]:
    cases = []
    for signal in signals:
        case = signal.get("business_case")
        if not case:
            continue
        cases.append({
            "company": case.get("company_or_case", "Case"),
            "title": signal.get("title", "Business Transformation"),
            "category": " / ".join(signal.get("categories", [])[:2]) or "Business",
            "problem": case.get("problem", ""),
            "change": case.get("change", ""),
            "result": case.get("measurable_outcome", ""),
            "lesson": case.get("transferable_lesson", ""),
            "evidence": signal.get("source_class", "ANALYSIS"),
        })
        if len(cases) >= 6:
            break
    return cases


def build_report_json(
    draft: RadarDraft,
    signals: list[dict],
    notes: list[str],
    report_date: date,
    start: datetime,
    end: datetime,
) -> dict:
    top5 = signals[:5]
    critical = sum(1 for x in signals if x["score"] >= 95)
    important = sum(1 for x in signals if 85 <= x["score"] < 95)
    emerging = sum(1 for x in signals if x.get("emerging_signal"))
    uncertain = sum(1 for x in signals if not x.get("window_verified"))
    grade = "A" if uncertain == 0 else "A-" if uncertain <= 2 else "B"

    return {
        "date": report_date.isoformat(),
        "generated_at": datetime.now(TZ).isoformat(timespec="seconds"),
        "engine_version": "m2-daily-automation-v1",
        "window": {
            "start": start.strftime("%Y-%m-%d %H:%M"),
            "end": end.strftime("%Y-%m-%d %H:%M"),
            "timezone": "Asia/Taipei",
        },
        "world_summary": draft.world_summary,
        "counts": {"critical": critical, "important": important, "emerging": emerging},
        "quality": {
            "window_verified": all(x.get("window_verified") for x in top5),
            "grade": grade,
            "notes": notes[-20:],
        },
        "top5_ids": [x["id"] for x in top5],
        "signals": signals,
        "emerging_signals": build_emerging_cards(signals, report_date.isoformat()),
        "impact_chain": (top5[0].get("impact_chain") if top5 else []),
        "topic_summary": build_topic_summary(signals),
        "market": build_market(draft, end),
        "taiwan_radar": build_taiwan_radar(signals),
        "business_cases": build_business_cases(signals),
    }


def update_index(report: dict) -> None:
    index_path = DATA_DIR / "index.json"
    if index_path.exists():
        try:
            index = load_json(index_path)
        except Exception:
            index = {"reports": []}
    else:
        index = {"reports": []}

    reports = [r for r in index.get("reports", []) if r.get("date") != report["date"]]
    reports.insert(
        0,
        {
            "date": report["date"],
            "signals": len(report["signals"]),
            "summary": report["world_summary"],
        },
    )
    index["reports"] = reports[:365]
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def atomic_publish(report: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    report_date = report["date"]
    tmp_report = TMP_DIR / f"{report_date}.json"
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    tmp_report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Publish date archive first, then latest. If generation failed earlier, neither is touched.
    archive = DATA_DIR / f"{report_date}.json"
    archive.write_text(tmp_report.read_text(encoding="utf-8"), encoding="utf-8")
    (DATA_DIR / "latest.json").write_text(tmp_report.read_text(encoding="utf-8"), encoding="utf-8")
    update_index(report)


def main() -> int:
    if not os.getenv("OPENAI_API_KEY"):
        print("[skip] OPENAI_API_KEY is not configured. Existing latest.json is preserved.")
        return 0

    now = datetime.now(TZ)
    report_date = compute_report_date(now)
    start, end = build_window(report_date)
    if now < end and not os.getenv("REPORT_DATE"):
        print(f"[skip] Window has not closed yet. Cutoff is {iso_taipei(end)}")
        return 0

    registry = load_json(CONFIG_DIR / "sources.json")
    profile = load_json(CONFIG_DIR / "editorial_profile.json")
    client = OpenAI()

    print(f"[window] {iso_taipei(start)} -> {iso_taipei(end)}")
    evidence = collect_evidence(client, registry, start, end)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    (TMP_DIR / "evidence.json").write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    draft = synthesize(client, evidence, start, end, profile)
    signals, notes = verify_and_normalize(draft, report_date, start, end)
    report = build_report_json(draft, signals, notes, report_date, start, end)
    atomic_publish(report)

    print(
        f"[done] {report_date}: {len(signals)} signals, "
        f"quality={report['quality']['grade']}, top5={report['top5_ids']}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[fatal] {type(exc).__name__}: {exc}", file=sys.stderr)
        # Fail hard so GitHub does not commit partial/bad data. Existing latest.json stays intact.
        raise

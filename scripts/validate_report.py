from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from dateutil import parser as dtparser

ROOT = Path(__file__).resolve().parents[1]
TZ = ZoneInfo("Asia/Taipei")


def parse(value: str | None):
    if not value:
        return None
    dt = dtparser.isoparse(value)
    if dt.tzinfo is None:
        raise ValueError(f"Timestamp lacks timezone: {value}")
    return dt.astimezone(TZ)


def _validate_extensions(report: dict, signal_ids: set[str]) -> None:
    trend_meta = report.get("trend_meta")
    if trend_meta is not None:
        days = int(trend_meta.get("available_history_days", 0))
        full_days = int(trend_meta.get("full_window_days", 7))
        if days < 1 or days > full_days:
            raise SystemExit("trend_meta available_history_days is outside valid range")
        dates = trend_meta.get("history_dates") or []
        if len(dates) != days:
            raise SystemExit("trend_meta history_dates length must match available_history_days")

    for item in report.get("emerging_signals") or []:
        series = item.get("series") or []
        if trend_meta and len(series) != int(trend_meta.get("available_history_days", 0)):
            raise SystemExit(f"Emerging signal series length mismatch: {item.get('id')}")
        if not 0 <= int(item.get("trend_score", 0)) <= 99:
            raise SystemExit(f"Invalid emerging trend_score: {item.get('id')}")
        linked = item.get("signal_ids") or []
        if not linked or any(signal_id not in signal_ids for signal_id in linked):
            raise SystemExit(f"Emerging signal references missing report signal: {item.get('id')}")

    impact_chains = report.get("impact_chains") or []
    chain_ids = set()
    for chain in impact_chains:
        chain_id = chain.get("id")
        if not chain_id or chain_id in chain_ids:
            raise SystemExit("Duplicate or missing impact chain id")
        chain_ids.add(chain_id)
        anchor = chain.get("anchor_signal_id")
        if anchor not in signal_ids:
            raise SystemExit(f"Impact chain anchor references missing signal: {chain_id}")
        confidence = float(chain.get("confidence", 0))
        if not 0 <= confidence <= 1:
            raise SystemExit(f"Impact chain confidence outside 0..1: {chain_id}")
        nodes = chain.get("nodes") or []
        node_ids = {node.get("id") for node in nodes}
        if len(nodes) < 2 or None in node_ids or len(node_ids) != len(nodes):
            raise SystemExit(f"Impact chain has invalid nodes: {chain_id}")
        for edge in chain.get("edges") or []:
            relation = edge.get("relation")
            if relation not in {"SUPPORTED", "POTENTIAL"}:
                raise SystemExit(f"Invalid impact relation: {chain_id}")
            if edge.get("from") not in node_ids or edge.get("to") not in node_ids:
                raise SystemExit(f"Impact edge references missing node: {chain_id}")
            evidence = edge.get("evidence_signal_ids") or []
            if any(signal_id not in signal_ids for signal_id in evidence):
                raise SystemExit(f"Impact edge references missing evidence signal: {chain_id}")
            if relation == "SUPPORTED" and not evidence:
                raise SystemExit(f"SUPPORTED impact edge requires evidence: {chain_id}")
            if relation == "POTENTIAL" and evidence:
                raise SystemExit(f"POTENTIAL impact edge must not masquerade as observed evidence: {chain_id}")

    featured = report.get("featured_impact_chain_id")
    if featured is not None and featured not in chain_ids:
        raise SystemExit("featured_impact_chain_id references missing impact chain")


def main(path: str = "data/latest.json") -> int:
    report_path = ROOT / path
    report = json.loads(report_path.read_text(encoding="utf-8"))
    start = datetime.strptime(report["window"]["start"], "%Y-%m-%d %H:%M").replace(tzinfo=TZ)
    end = datetime.strptime(report["window"]["end"], "%Y-%m-%d %H:%M").replace(tzinfo=TZ)

    signals = report.get("signals", [])
    if len(signals) < 5:
        raise SystemExit("Report must contain at least 5 verified signals")
    if len(signals) > 20:
        raise SystemExit("Report exceeds 20-signal editorial cap")

    ids = set()
    for signal in signals:
        if signal["id"] in ids:
            raise SystemExit(f"Duplicate signal id: {signal['id']}")
        ids.add(signal["id"])
        text = signal.get("title", "") + signal.get("what_happened", "")
        compact = "".join(text.split())
        if "換股價差" in compact or (("三商壽" in compact or "三商美邦" in compact) and "玉山金" in compact):
            raise SystemExit("Excluded 三商壽 × 玉山金 topic leaked into report")
        observed = parse(signal.get("observed_at"))
        if observed and not (start <= observed <= end):
            raise SystemExit(f"Look-ahead contamination in observed_at: {signal['title']}")
        for source in signal.get("sources", []):
            published = parse(source.get("published_at"))
            if published and published > end:
                raise SystemExit(f"Post-cutoff source leaked into report: {signal['title']}")
            if not source.get("url", "").startswith(("https://", "http://")):
                raise SystemExit(f"Invalid source URL: {signal['title']}")

    top5_ids = report.get("top5_ids", [])
    if len(top5_ids) != 5:
        raise SystemExit("top5_ids must contain exactly 5 ids")
    top5 = [s for s in signals if s["id"] in top5_ids]
    if len(top5) != 5:
        raise SystemExit("top5_ids reference missing signals")
    for signal in top5:
        if not signal.get("window_verified"):
            raise SystemExit(f"Top 5 signal is not window verified: {signal['title']}")
        if not any(src.get("class") in ("PRIMARY", "CONFIRMED") for src in signal.get("sources", [])):
            raise SystemExit(f"Top 5 lacks authoritative source: {signal['title']}")

    _validate_extensions(report, ids)

    print(f"OK: {report['date']} / {len(signals)} signals / cutoff {report['window']['end']} Asia/Taipei")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "data/latest.json"))

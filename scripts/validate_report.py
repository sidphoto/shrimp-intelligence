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

    print(f"OK: {report['date']} / {len(signals)} signals / cutoff {report['window']['end']} Asia/Taipei")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1] if len(sys.argv) > 1 else "data/latest.json"))

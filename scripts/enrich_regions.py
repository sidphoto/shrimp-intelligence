from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

REGION_PATTERNS: dict[str, tuple[str, ...]] = {
    "taiwan": (r"\btaiwan\b", r"台灣|臺灣|台北|臺北", r"đài loan", r"taipei"),
    "us": (
        r"\bu\.?s\.?\b",
        r"united states",
        r"america(?:n)?",
        r"美國|美方|華府",
        r"hoa kỳ",
        r"washington",
        r"federal reserve",
        r"\bfed\b",
    ),
    "china": (r"\bchina\b", r"chinese", r"中國|北京|中方", r"trung quốc", r"beijing"),
    "japan": (
        r"\bjapan\b",
        r"japanese",
        r"日本|東京|日圓|日銀",
        r"nhật bản",
        r"tokyo",
        r"bank of japan",
        r"\bboj\b",
    ),
    "vietnam": (r"\bvietnam\b", r"vietnamese", r"越南|河內", r"việt nam", r"hanoi"),
    "asia": (r"\basia\b", r"asian", r"亞洲|亞太", r"châu á", r"asia-pacific", r"apac"),
    "europe": (r"\beurope\b", r"european", r"歐洲", r"châu âu"),
    "eu": (r"european union", r"歐盟", r"liên minh châu âu", r"\beu\b", r"\becb\b"),
    "middle-east": (
        r"middle east",
        r"中東",
        r"trung đông",
        r"iran",
        r"iranian",
        r"伊朗",
        r"israel",
        r"以色列",
        r"gulf",
        r"hormuz",
    ),
}


def infer_regions(signal: dict) -> list[str]:
    regions = list(dict.fromkeys(signal.get("regions") or []))
    text = " ".join(
        str(signal.get(key) or "")
        for key in (
            "title",
            "what_happened",
            "why_now",
            "why_important",
            "taiwan_impact",
            "what_next",
            "source_label",
        )
    ).lower()

    for region, patterns in REGION_PATTERNS.items():
        if any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns):
            if region not in regions:
                regions.append(region)

    if not regions:
        regions.append("global")
    return regions


def enrich_report_regions(report: dict) -> dict:
    for signal in report.get("signals", []):
        signal["regions"] = infer_regions(signal)
    report["region_tagging_version"] = "m4-keyword-v1"
    return report


def _write(path: Path, report: dict) -> None:
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    latest = DATA_DIR / "latest.json"
    if not latest.exists():
        raise RuntimeError("data/latest.json is missing")
    report = json.loads(latest.read_text(encoding="utf-8"))
    enrich_report_regions(report)
    _write(latest, report)
    archive = DATA_DIR / f"{report['date']}.json"
    if archive.exists():
        _write(archive, report)
    print(f"[regions] enriched {len(report.get('signals', []))} signals")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

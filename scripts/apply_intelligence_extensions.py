from __future__ import annotations

import json
from pathlib import Path

from build_impact_chains import build_impact_chains
from build_trends import build_emerging_signals

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"


def _write(path: Path, report: dict) -> None:
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _update_demo_index(report: dict) -> None:
    index_path = DATA_DIR / "index.json"
    index = {"reports": []}
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    reports = [item for item in index.get("reports", []) if item.get("date") != report.get("date")]
    reports.insert(
        0,
        {
            "date": report.get("date"),
            "signals": len(report.get("signals", [])),
            "summary": "Synthetic public demo fixture.",
        },
    )
    index["reports"] = reports[:30]
    _write(index_path, index)


def main() -> int:
    latest_path = DATA_DIR / "latest.json"
    if not latest_path.exists():
        raise RuntimeError("data/latest.json is missing")

    report = json.loads(latest_path.read_text(encoding="utf-8"))
    if report.get("demo") is not True:
        raise RuntimeError("Public extension builder only accepts demo=true reports")

    build_emerging_signals(report)
    build_impact_chains(report)
    report["intelligence_extensions_version"] = "public-demo-trends-impact-v1"

    _write(latest_path, report)
    _write(DATA_DIR / f"{report['date']}.json", report)
    _update_demo_index(report)

    print(
        f"[public-demo-extensions] trends={len(report.get('emerging_signals', []))} "
        f"impact_chains={len(report.get('impact_chains', []))}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

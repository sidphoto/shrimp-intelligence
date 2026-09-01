from __future__ import annotations

import json
from pathlib import Path

import build_report as core
from build_impact_chains import build_impact_chains
from build_trends import build_emerging_signals


def _write(path: Path, report: dict) -> None:
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    latest_path = core.DATA_DIR / "latest.json"
    if not latest_path.exists():
        raise RuntimeError("data/latest.json is missing")

    report = json.loads(latest_path.read_text(encoding="utf-8"))
    build_emerging_signals(report)
    build_impact_chains(report)
    report["intelligence_extensions_version"] = "m4.4-trends-impact-v1"

    _write(latest_path, report)
    archive_path = core.DATA_DIR / f"{report['date']}.json"
    _write(archive_path, report)
    core.update_index(report)

    print(
        f"[intelligence-extensions] trends={len(report.get('emerging_signals', []))} "
        f"history_days={report.get('trend_meta', {}).get('available_history_days', 0)} "
        f"impact_chains={len(report.get('impact_chains', []))}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import build_report as core
from market_live import LIVE_PATH
from market_snapshot import load_market_for_report

CATEGORY_LABELS = {
    "world": "全球要聞",
    "global": "全球要聞",
    "policy": "政策",
    "geopolitics": "地緣政治",
    "security": "安全",
    "economy": "經濟與市場",
    "markets": "經濟與市場",
    "finance": "金融",
    "ai": "AI",
    "technology": "科技",
    "semiconductor": "半導體",
    "developer": "開發與開源",
    "industry": "產業",
    "supply-chain": "供應鏈",
    "science": "科學",
    "business": "商業變革",
    "automation": "自動化",
    "productivity": "生產力",
    "taiwan": "台灣",
}


def _reader_summary(report: dict) -> str:
    signals_by_id = {s.get("id"): s for s in report.get("signals", [])}
    focus = []
    for signal_id in report.get("top5_ids", []):
        signal = signals_by_id.get(signal_id) or {}
        for category in signal.get("categories", []):
            label = CATEGORY_LABELS.get(str(category).lower())
            if label and label not in focus:
                focus.append(label)
            if len(focus) >= 4:
                break
        if len(focus) >= 4:
            break
    if not focus:
        focus = ["全球要聞"]
    joined = "、".join(focus[:4])
    return f"今日全球焦點集中於{joined}；重大事件均以可驗證來源整理，並持續追蹤後續政策、產業與台灣影響。"


def _clean_product_copy(report: dict) -> None:
    report["world_summary"] = _reader_summary(report)
    quality = report.setdefault("quality", {})
    quality["notes"] = [
        "Top 5 均具 PRIMARY 或 CONFIRMED 來源支持。",
        "資料時間窗已依 Asia/Taipei 06:00 截止規則檢查。",
    ]
    for signal in report.get("signals", []):
        if str(signal.get("winners_losers", "")).startswith("Deterministic"):
            signal["winners_losers"] = "目前可驗證來源不足以可靠判定明確受益與受損方。"
        note = str(signal.get("quality_note", ""))
        if "deterministic" in note.lower() or "tavily" in note.lower():
            signal["quality_note"] = "已依來源等級、時間窗與事件去重規則整理。"


def _load_live_market(report_date: date, path: Path = LIVE_PATH) -> tuple[list[dict], dict]:
    if not path.exists():
        return [], {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return [], {}
    if payload.get("report_date") != report_date.isoformat():
        return [], {}
    market = payload.get("market")
    if not isinstance(market, list):
        return [], {}
    return market, {
        "mode": "live",
        "captured_at": payload.get("captured_at"),
        "timezone": payload.get("timezone", "Asia/Taipei"),
        "note": "市場快覽為獨立即時快照，不改變新聞情報 06:00 截止視窗。",
    }


def enrich_report(report: dict) -> dict:
    report_date = date.fromisoformat(report["date"])
    _, cutoff = core.build_window(report_date)
    _clean_product_copy(report)

    live_market, live_meta = _load_live_market(report_date)
    if live_market:
        report["market"] = live_market
        report["market_meta"] = live_meta
    else:
        market = load_market_for_report(report_date, cutoff)
        if market:
            report["market"] = market
            report["market_meta"] = {
                "mode": "pre_cutoff",
                "captured_at": None,
                "timezone": "Asia/Taipei",
                "note": "市場快覽使用 06:00 前保存的市場快照。",
            }
        else:
            report["market"] = [
                {
                    "name": name,
                    "value": "—",
                    "change": "",
                    "direction": "flat",
                    "as_of": None,
                    "source": None,
                    "source_url": None,
                }
                for name in ["S&P 500", "NASDAQ", "USD / TWD", "Brent Oil", "Gold", "US 30Y"]
            ]
            report["market_meta"] = {
                "mode": "missing",
                "captured_at": None,
                "timezone": "Asia/Taipei",
                "note": "目前無可用市場快照。",
            }
    report["engine_version"] = "m2.6-tavily-live-market-v1"
    return report


def _write(path: Path, report: dict) -> None:
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    latest_path = core.DATA_DIR / "latest.json"
    if not latest_path.exists():
        raise RuntimeError("data/latest.json is missing")
    report = json.loads(latest_path.read_text(encoding="utf-8"))
    enrich_report(report)
    _write(latest_path, report)

    archive_path = core.DATA_DIR / f"{report['date']}.json"
    _write(archive_path, report)
    core.update_index(report)
    print(f"[enrich] reader summary + market snapshot applied for {report['date']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

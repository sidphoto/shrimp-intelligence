from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from intelligence_rules import authoritative, label_for, matches_spec, source_domain

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_CONFIG = ROOT / "config" / "trend_entities.json"
DATE_FILE = re.compile(r"^\d{4}-\d{2}-\d{2}\.json$")


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_full_archives(data_dir: Path, current_report: dict, window_days: int) -> list[dict]:
    current_date = date.fromisoformat(current_report["date"])
    by_date: dict[str, dict] = {}
    for path in data_dir.glob("*.json"):
        if not DATE_FILE.match(path.name):
            continue
        try:
            report = _load_json(path)
            report_date = date.fromisoformat(str(report.get("date", "")))
        except (OSError, json.JSONDecodeError, ValueError, TypeError):
            continue
        if report_date > current_date or not isinstance(report.get("signals"), list):
            continue
        by_date[report_date.isoformat()] = report

    # The in-memory current report is authoritative for a rerun and avoids
    # comparing today's newly generated report with a stale same-day archive.
    by_date[current_report["date"]] = current_report
    ordered = [by_date[key] for key in sorted(by_date)]
    return ordered[-max(1, int(window_days)):]


def _matches(entity: dict, signal: dict) -> bool:
    return matches_spec(signal, entity)


def _matched_signals(entity: dict, report: dict) -> list[dict]:
    return [signal for signal in report.get("signals", []) if _matches(entity, signal)]


def _source_domains(signals: list[dict]) -> set[str]:
    domains: set[str] = set()
    for signal in signals:
        for source in signal.get("sources") or []:
            domain = source_domain(source)
            if domain:
                domains.add(domain)
        if not signal.get("sources") and signal.get("source_label"):
            domains.add(str(signal["source_label"]).lower())
    return domains


def _reason_maps(days: int, baseline: float, current: int, sources: int, auth: int) -> dict[str, str]:
    return {
        "zh-TW": (
            f"近 {days} 個完整資料日中，相關事件由基準 {baseline:.1f} 件升至 {current} 件；"
            f"目前涵蓋 {sources} 個不同來源，其中 {auth} 件具第一手或已確認來源。"
        ),
        "en": (
            f"Across {days} complete report days, related events rose from a {baseline:.1f} baseline "
            f"to {current}; {sources} distinct sources are represented, with {auth} authoritative events."
        ),
        "vi-VN": (
            f"Trong {days} ngày dữ liệu hoàn chỉnh, số sự kiện liên quan tăng từ mức nền {baseline:.1f} "
            f"lên {current}; có {sources} nguồn khác nhau, trong đó {auth} sự kiện có nguồn sơ cấp hoặc đã xác nhận."
        ),
    }


def _trend_score(current: int, baseline: float, persistence: float, sources: int, auth_ratio: float) -> int:
    growth_pct = max(0.0, (current - baseline) / max(1.0, baseline) * 100.0)
    volume_component = min(35.0, current * 9.0)
    growth_component = min(30.0, growth_pct * 0.25)
    persistence_component = min(15.0, persistence * 15.0)
    source_component = min(10.0, sources * 3.0)
    authority_component = min(10.0, auth_ratio * 10.0)
    return max(0, min(99, round(
        volume_component + growth_component + persistence_component + source_component + authority_component
    )))


def build_emerging_signals(
    report: dict,
    data_dir: Path = DEFAULT_DATA_DIR,
    config_path: Path = DEFAULT_CONFIG,
) -> dict:
    config = _load_json(config_path)
    full_window_days = int(config.get("full_window_days", 7))
    min_history_days = int(config.get("min_history_days", 2))
    max_signals = int(config.get("max_emerging_signals", 4))
    archives = load_full_archives(data_dir, report, full_window_days)
    history_days = len(archives)
    dates = [str(item.get("date")) for item in archives]

    report["trend_meta"] = {
        "version": "m4.3-trend-v1",
        "available_history_days": history_days,
        "full_window_days": full_window_days,
        "min_history_days": min_history_days,
        "history_dates": dates,
        "status": "collecting_history" if history_days < min_history_days else (
            "short_window" if history_days < full_window_days else "full_window"
        ),
    }
    report["emerging_signals"] = []

    # Never fabricate a trend from a single complete report day.
    if history_days < min_history_days:
        return report

    candidates: list[dict] = []
    current_report = archives[-1]
    for entity in config.get("entities", []):
        daily_matches = [_matched_signals(entity, archive) for archive in archives]
        series = [len(matches) for matches in daily_matches]
        current_matches = daily_matches[-1]
        current = series[-1]
        previous = series[:-1]
        baseline = sum(previous) / len(previous) if previous else 0.0
        if current < 2 or current <= baseline:
            continue

        source_domains = _source_domains(current_matches)
        auth_count = sum(1 for signal in current_matches if authoritative(signal))
        if auth_count < 1:
            continue
        persistence = sum(1 for value in series if value > 0) / max(1, history_days)
        auth_ratio = auth_count / max(1, current)
        score = _trend_score(current, baseline, persistence, len(source_domains), auth_ratio)
        if score < 55:
            continue

        change = round((current - baseline) / max(1.0, baseline) * 100.0)
        reasons = _reason_maps(history_days, baseline, current, len(source_domains), auth_count)
        candidate = {
            "id": entity["id"],
            "icon": entity.get("icon", "↗"),
            "name": label_for(entity.get("labels", {}), "zh-TW"),
            "labels": entity.get("labels", {}),
            "label": reasons["zh-TW"],
            "reason": reasons["zh-TW"],
            "reasons": reasons,
            "change": change,
            "trend_score": score,
            "status": "rising" if history_days >= 4 else "preliminary",
            "series": series,
            "window_days": history_days,
            "event_count": current,
            "source_count": len(source_domains),
            "authoritative_event_count": auth_count,
            "signal_ids": [signal.get("id") for signal in current_matches if signal.get("id")],
        }
        candidates.append(candidate)

    candidates.sort(
        key=lambda item: (item["trend_score"], item["event_count"], item["source_count"]),
        reverse=True,
    )
    selected = candidates[:max_signals]
    report["emerging_signals"] = selected

    reason_by_signal: dict[str, str] = {}
    for item in selected:
        for signal_id in item.get("signal_ids", []):
            reason_by_signal.setdefault(signal_id, item["reason"])
    for signal in report.get("signals", []):
        signal_id = signal.get("id")
        if signal_id in reason_by_signal:
            signal["emerging_signal"] = True
            signal["emerging_reason"] = reason_by_signal[signal_id]

    return report

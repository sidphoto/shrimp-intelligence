from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCALE_DIR = ROOT / "locales"
DATA_DIR = ROOT / "data"
SUPPORTED = ("zh-TW", "en", "vi-VN")
DEFAULT = "zh-TW"
LOCALIZABLE_SIGNAL_FIELDS = {
    "title",
    "what_happened",
    "why_now",
    "why_important",
    "winners_losers",
    "taiwan_impact",
    "what_next",
    "emerging_reason",
    "quality_note",
}
OVERLAY_TOP_LEVEL = {"locale", "date", "world_summary", "signals", "taiwan_radar"}


def load_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise AssertionError(f"Expected JSON object: {path}")
    return value


def flatten(value: dict, prefix: str = "") -> dict[str, object]:
    result: dict[str, object] = {}
    for key, item in value.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(item, dict):
            result.update(flatten(item, path))
        else:
            result[path] = item
    return result


def validate_locale_files() -> None:
    locale_values = {locale: load_json(LOCALE_DIR / f"{locale}.json") for locale in SUPPORTED}
    baseline = flatten(locale_values[DEFAULT])
    baseline_keys = set(baseline)

    for locale, value in locale_values.items():
        flat = flatten(value)
        keys = set(flat)
        missing = sorted(baseline_keys - keys)
        extra = sorted(keys - baseline_keys)
        if missing or extra:
            raise AssertionError(f"Locale key mismatch for {locale}: missing={missing}, extra={extra}")
        empty = sorted(key for key, item in flat.items() if not isinstance(item, str) or not item.strip())
        if empty:
            raise AssertionError(f"Locale {locale} has empty/non-string leaves: {empty}")

    for locale in SUPPORTED:
        title = locale_values[locale]["meta"]["title"]
        if "Shrimp Intelligence" in title:
            raise AssertionError(f"Legacy brand exposed in {locale} meta.title")


def canonical_report_for_overlay(path: Path) -> dict:
    if path.name == "latest.json":
        canonical = DATA_DIR / "latest.json"
    else:
        canonical = DATA_DIR / path.name
        if not canonical.exists():
            canonical = DATA_DIR / "latest.json"
    return load_json(canonical)


def validate_overlay(path: Path, locale: str) -> None:
    overlay = load_json(path)
    unknown_top = sorted(set(overlay) - OVERLAY_TOP_LEVEL)
    if unknown_top:
        raise AssertionError(f"Unknown localized overlay fields in {path}: {unknown_top}")

    declared_locale = overlay.get("locale")
    if declared_locale is not None and declared_locale != locale:
        raise AssertionError(f"Locale mismatch in {path}: {declared_locale} != {locale}")

    canonical = canonical_report_for_overlay(path)
    canonical_date = canonical.get("date")
    overlay_date = overlay.get("date")
    if path.stem != "latest" and overlay_date is not None and overlay_date != path.stem:
        raise AssertionError(f"Dated overlay date mismatch in {path}: {overlay_date} != {path.stem}")
    if overlay_date is not None and canonical_date is not None and overlay_date != canonical_date:
        raise AssertionError(f"Overlay/canonical report date mismatch in {path}: {overlay_date} != {canonical_date}")

    signal_ids = {signal.get("id") for signal in canonical.get("signals", [])}
    signals = overlay.get("signals", {})
    if signals is not None and not isinstance(signals, dict):
        raise AssertionError(f"signals must be an object keyed by canonical signal id: {path}")

    for signal_id, localized in (signals or {}).items():
        if signal_id not in signal_ids:
            raise AssertionError(f"Unknown canonical signal id in {path}: {signal_id}")
        if not isinstance(localized, dict):
            raise AssertionError(f"Localized signal must be an object in {path}: {signal_id}")
        forbidden = sorted(set(localized) - LOCALIZABLE_SIGNAL_FIELDS)
        if forbidden:
            raise AssertionError(
                f"Localized overlay attempted to mutate canonical machine fields in {path} / {signal_id}: {forbidden}"
            )
        for field, value in localized.items():
            if not isinstance(value, str):
                raise AssertionError(f"Localized field must be a string: {path} / {signal_id} / {field}")

    if "world_summary" in overlay and not isinstance(overlay["world_summary"], str):
        raise AssertionError(f"world_summary must be a string: {path}")
    if "taiwan_radar" in overlay:
        radar = overlay["taiwan_radar"]
        if not isinstance(radar, list) or not all(isinstance(item, str) for item in radar):
            raise AssertionError(f"taiwan_radar must be a string array: {path}")


def validate_localized_overlays() -> None:
    localized_root = DATA_DIR / "localized"
    if not localized_root.exists():
        return
    for locale in SUPPORTED:
        directory = localized_root / locale
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            validate_overlay(path, locale)


def main() -> int:
    validate_locale_files()
    validate_localized_overlays()
    print("i18n validation PASS: locale parity, non-empty strings, dated overlays, and canonical overlay safety")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
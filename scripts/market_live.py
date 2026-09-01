from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from market_snapshot import STOOQ_SYMBOLS, fetch_fred_30y, fetch_market_quote

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
LIVE_PATH = DATA_DIR / "market-live.json"
TZ = ZoneInfo("Asia/Taipei")


def build_live_snapshot(now: datetime | None = None) -> dict:
    now = (now or datetime.now(TZ)).astimezone(TZ)
    market = []

    for name, symbol, kind in STOOQ_SYMBOLS:
        item = fetch_market_quote(name, symbol, kind)
        if item is None:
            item = {
                "name": name,
                "value": "—",
                "change": "目前來源暫時無資料",
                "direction": "flat",
                "as_of": None,
                "source": "Yahoo Finance / Stooq fallback",
                "source_url": None,
            }
        market.append(item)

    treasury = fetch_fred_30y()
    if treasury is None:
        treasury = {
            "name": "US 30Y",
            "value": "—",
            "change": "官方日資料暫時無資料",
            "direction": "flat",
            "as_of": None,
            "source": "Federal Reserve H.15 via FRED",
            "source_url": "https://fred.stlouisfed.org/series/DGS30",
        }
    market.append(treasury)

    return {
        "kind": "live_market_snapshot",
        "report_date": now.date().isoformat(),
        "captured_at": now.isoformat(timespec="seconds"),
        "timezone": "Asia/Taipei",
        "note": "Independent market snapshot. It does not change the intelligence report 06:00 cutoff.",
        "market": market,
    }


def write_live_snapshot(payload: dict, path: Path = LIVE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    payload = build_live_snapshot()
    write_live_snapshot(payload)
    populated = sum(1 for x in payload["market"] if x.get("value") not in (None, "", "—"))
    print(
        f"[market-live] captured {populated}/{len(payload['market'])} metrics "
        f"at {payload['captured_at']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

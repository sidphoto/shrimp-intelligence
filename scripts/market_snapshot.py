from __future__ import annotations

import csv
import io
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time
from pathlib import Path
from typing import Callable
from zoneinfo import ZoneInfo

from dateutil import parser as dtparser

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
SNAPSHOT_PATH = DATA_DIR / "market-snapshot.json"
TZ = ZoneInfo("Asia/Taipei")

STOOQ_SYMBOLS = [
    ("S&P 500", "^spx", "index"),
    ("NASDAQ", "^ndq", "index"),
    ("USD / TWD", "usdtwd", "fx"),
    ("Brent Oil", "cb.f", "commodity"),
    ("Gold", "xauusd", "commodity"),
]

FRED_30Y_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30"


def _http_get(url: str, timeout: int = 12) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "SharBo-Globo/1.0 (+https://github.com/sidphoto/shrimp-intelligence)"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def _fmt_number(value: float, kind: str) -> str:
    if kind == "index":
        return f"{value:,.2f}"
    if kind == "fx":
        return f"{value:.4f}"
    if kind == "commodity":
        return f"{value:,.2f}"
    return f"{value:g}"


def parse_stooq_quote(text: str, name: str, symbol: str, kind: str) -> dict | None:
    rows = list(csv.DictReader(io.StringIO(text.strip())))
    if not rows:
        return None
    row = rows[0]
    if any(str(row.get(k, "")).strip().upper() in {"", "N/D"} for k in ("Open", "Close")):
        return None
    try:
        open_value = float(row["Open"])
        close_value = float(row["Close"])
    except (KeyError, TypeError, ValueError):
        return None

    change_pct = ((close_value - open_value) / open_value * 100.0) if open_value else 0.0
    direction = "up" if change_pct > 0.005 else "down" if change_pct < -0.005 else "flat"
    sign = "+" if change_pct > 0 else ""
    source_url = (
        "https://stooq.com/q/l/?"
        + urllib.parse.urlencode({"s": symbol, "f": "sd2t2ohlcv", "h": "", "e": "csv"})
    )
    return {
        "name": name,
        "value": _fmt_number(close_value, kind),
        "change": f"較開盤 {sign}{change_pct:.2f}%",
        "direction": direction,
        "as_of": " ".join(x for x in [row.get("Date", ""), row.get("Time", "")] if x).strip(),
        "source": "Stooq quote snapshot",
        "source_url": source_url,
    }


def fetch_stooq_quote(
    name: str,
    symbol: str,
    kind: str,
    fetcher: Callable[[str], str] = _http_get,
) -> dict | None:
    url = (
        "https://stooq.com/q/l/?"
        + urllib.parse.urlencode({"s": symbol, "f": "sd2t2ohlcv", "h": "", "e": "csv"})
    )
    try:
        return parse_stooq_quote(fetcher(url), name, symbol, kind)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return None


def parse_fred_30y(text: str) -> dict | None:
    rows = list(csv.DictReader(io.StringIO(text.strip())))
    values: list[tuple[str, float]] = []
    for row in rows:
        raw = row.get("DGS30")
        if raw in (None, "", "."):
            continue
        try:
            values.append((row.get("DATE") or row.get("observation_date") or "", float(raw)))
        except (TypeError, ValueError):
            continue
    if not values:
        return None
    latest_date, latest = values[-1]
    previous = values[-2][1] if len(values) >= 2 else latest
    bp = round((latest - previous) * 100)
    direction = "up" if bp > 0 else "down" if bp < 0 else "flat"
    sign = "+" if bp > 0 else ""
    return {
        "name": "US 30Y",
        "value": f"{latest:.2f}%",
        "change": f"較前值 {sign}{bp} bp",
        "direction": direction,
        "as_of": latest_date,
        "source": "Federal Reserve H.15 via FRED",
        "source_url": "https://fred.stlouisfed.org/series/DGS30",
    }


def fetch_fred_30y(fetcher: Callable[[str], str] = _http_get) -> dict | None:
    try:
        return parse_fred_30y(fetcher(FRED_30Y_URL))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return None


def build_snapshot(now: datetime | None = None) -> dict:
    now = (now or datetime.now(TZ)).astimezone(TZ)
    cutoff = datetime.combine(now.date(), time(6, 0), tzinfo=TZ)
    if now >= cutoff:
        raise RuntimeError(
            f"Market snapshot must be captured before the 06:00 cutoff; now={now.isoformat(timespec='minutes')}"
        )

    market = []
    for name, symbol, kind in STOOQ_SYMBOLS:
        item = fetch_stooq_quote(name, symbol, kind)
        if item is None:
            item = {
                "name": name,
                "value": "—",
                "change": "快照來源暫時無資料",
                "direction": "flat",
                "as_of": None,
                "source": "Stooq quote snapshot",
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
        "report_date": now.date().isoformat(),
        "captured_at": now.isoformat(timespec="seconds"),
        "cutoff": cutoff.isoformat(timespec="seconds"),
        "market": market,
    }


def write_snapshot(snapshot: dict, path: Path = SNAPSHOT_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_market_for_report(report_date: date, cutoff: datetime, path: Path = SNAPSHOT_PATH) -> list[dict]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("report_date") != report_date.isoformat():
            return []
        captured = dtparser.isoparse(payload.get("captured_at") or "")
        if captured.tzinfo is None:
            return []
        if captured.astimezone(TZ) > cutoff.astimezone(TZ):
            return []
        market = payload.get("market")
        return market if isinstance(market, list) else []
    except (ValueError, TypeError, json.JSONDecodeError):
        return []


def main() -> int:
    snapshot = build_snapshot()
    write_snapshot(snapshot)
    print(
        f"[market] captured {len(snapshot['market'])} metrics for {snapshot['report_date']} "
        f"at {snapshot['captured_at']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

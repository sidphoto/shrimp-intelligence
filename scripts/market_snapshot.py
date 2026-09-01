from __future__ import annotations

import csv
import io
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, time, timezone
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

YAHOO_SYMBOLS = {
    "S&P 500": "^GSPC",
    "NASDAQ": "^IXIC",
    "USD / TWD": "TWD=X",
    "Brent Oil": "BZ=F",
    "Gold": "GC=F",
}

FRED_30Y_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30"


def _http_get(url: str, timeout: int = 12) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SharBo-Globo/1.0; +https://github.com/sidphoto/shrimp-intelligence)",
            "Accept": "application/json,text/csv,text/plain,*/*",
        },
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


def _change_row(name: str, value: float, previous: float | None, kind: str, as_of: str | None, source: str, source_url: str) -> dict:
    if previous in (None, 0):
        change_pct = 0.0
    else:
        change_pct = (value - previous) / previous * 100.0
    direction = "up" if change_pct > 0.005 else "down" if change_pct < -0.005 else "flat"
    sign = "+" if change_pct > 0 else ""
    return {
        "name": name,
        "value": _fmt_number(value, kind),
        "change": f"較前值 {sign}{change_pct:.2f}%",
        "direction": direction,
        "as_of": as_of,
        "source": source,
        "source_url": source_url,
    }


def parse_yahoo_chart(text: str, name: str, symbol: str, kind: str) -> dict | None:
    try:
        payload = json.loads(text)
        result = (payload.get("chart", {}).get("result") or [None])[0]
        if not result:
            return None
        meta = result.get("meta") or {}
        value = meta.get("regularMarketPrice")
        previous = meta.get("chartPreviousClose")
        if previous is None:
            previous = meta.get("previousClose")

        if value is None:
            quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
            closes = [x for x in (quote.get("close") or []) if x is not None]
            if not closes:
                return None
            value = closes[-1]
            if previous is None and len(closes) >= 2:
                previous = closes[-2]

        market_time = meta.get("regularMarketTime")
        as_of = None
        if market_time:
            as_of = datetime.fromtimestamp(int(market_time), timezone.utc).astimezone(TZ).isoformat(timespec="seconds")

        source_url = (
            "https://query1.finance.yahoo.com/v8/finance/chart/"
            + urllib.parse.quote(symbol, safe="")
            + "?range=5d&interval=1d&includePrePost=false"
        )
        return _change_row(
            name=name,
            value=float(value),
            previous=float(previous) if previous is not None else None,
            kind=kind,
            as_of=as_of,
            source="Yahoo Finance chart snapshot",
            source_url=source_url,
        )
    except (json.JSONDecodeError, TypeError, ValueError, KeyError, IndexError):
        return None


def fetch_yahoo_quote(
    name: str,
    symbol: str,
    kind: str,
    fetcher: Callable[[str], str] = _http_get,
) -> dict | None:
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(symbol, safe="")
        + "?range=5d&interval=1d&includePrePost=false"
    )
    try:
        return parse_yahoo_chart(fetcher(url), name, symbol, kind)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError):
        return None


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

    source_url = (
        "https://stooq.com/q/l/?"
        + urllib.parse.urlencode({"s": symbol, "f": "sd2t2ohlcv", "h": "", "e": "csv"})
    )
    as_of = " ".join(x for x in [row.get("Date", ""), row.get("Time", "")] if x).strip()
    return _change_row(
        name=name,
        value=close_value,
        previous=open_value,
        kind=kind,
        as_of=as_of,
        source="Stooq quote snapshot",
        source_url=source_url,
    )


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


def fetch_market_quote(name: str, stooq_symbol: str, kind: str) -> dict | None:
    yahoo_symbol = YAHOO_SYMBOLS.get(name)
    if yahoo_symbol:
        item = fetch_yahoo_quote(name, yahoo_symbol, kind)
        if item is not None:
            return item
    return fetch_stooq_quote(name, stooq_symbol, kind)


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
        item = fetch_market_quote(name, symbol, kind)
        if item is None:
            item = {
                "name": name,
                "value": "—",
                "change": "快照來源暫時無資料",
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
    populated = sum(1 for x in snapshot["market"] if x.get("value") not in (None, "", "—"))
    print(
        f"[market] captured {populated}/{len(snapshot['market'])} metrics for {snapshot['report_date']} "
        f"at {snapshot['captured_at']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

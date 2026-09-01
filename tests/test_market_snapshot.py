import json
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from enrich_report import _load_live_market, enrich_report  # noqa: E402
from market_snapshot import (  # noqa: E402
    build_snapshot,
    load_market_for_report,
    parse_fred_30y,
    parse_stooq_quote,
    parse_yahoo_chart,
)

TZ = ZoneInfo("Asia/Taipei")


class MarketSnapshotTests(unittest.TestCase):
    def test_parse_yahoo_chart(self):
        text = json.dumps(
            {
                "chart": {
                    "result": [
                        {
                            "meta": {
                                "regularMarketPrice": 6840.0,
                                "chartPreviousClose": 6800.0,
                                "regularMarketTime": 1788238800,
                            },
                            "indicators": {"quote": [{"close": [6800.0, 6840.0]}]},
                        }
                    ],
                    "error": None,
                }
            }
        )
        row = parse_yahoo_chart(text, "S&P 500", "^GSPC", "index")
        self.assertIsNotNone(row)
        self.assertEqual(row["value"], "6,840.00")
        self.assertEqual(row["direction"], "up")
        self.assertIn("+0.59%", row["change"])
        self.assertEqual(row["source"], "Yahoo Finance chart snapshot")

    def test_parse_stooq_quote(self):
        text = (
            "Symbol,Date,Time,Open,High,Low,Close,Volume\n"
            "^SPX,2026-08-31,22:00:00,6800.00,6860.00,6790.00,6840.00,12345\n"
        )
        row = parse_stooq_quote(text, "S&P 500", "^spx", "index")
        self.assertIsNotNone(row)
        self.assertEqual(row["value"], "6,840.00")
        self.assertEqual(row["direction"], "up")
        self.assertIn("+0.59%", row["change"])

    def test_parse_fred_30y(self):
        text = "observation_date,DGS30\n2026-08-28,5.18\n2026-08-31,5.20\n"
        row = parse_fred_30y(text)
        self.assertIsNotNone(row)
        self.assertEqual(row["value"], "5.20%")
        self.assertEqual(row["direction"], "up")
        self.assertEqual(row["change"], "較前值 +2 bp")

    def test_snapshot_refuses_post_cutoff_capture(self):
        with self.assertRaises(RuntimeError):
            build_snapshot(datetime(2026, 9, 1, 6, 0, tzinfo=TZ))

    def test_loader_accepts_0555_and_rejects_post_cutoff(self):
        market = [{"name": "S&P 500", "value": "6,840.00", "change": "+0.5%", "direction": "up"}]
        cutoff = datetime(2026, 9, 1, 6, 0, tzinfo=TZ)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "market-snapshot.json"
            path.write_text(
                json.dumps(
                    {
                        "report_date": "2026-09-01",
                        "captured_at": "2026-09-01T05:55:00+08:00",
                        "market": market,
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(load_market_for_report(date(2026, 9, 1), cutoff, path), market)

            path.write_text(
                json.dumps(
                    {
                        "report_date": "2026-09-01",
                        "captured_at": "2026-09-01T06:00:01+08:00",
                        "market": market,
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(load_market_for_report(date(2026, 9, 1), cutoff, path), [])

    def test_live_market_is_same_day_only_and_keeps_own_timestamp(self):
        market = [{"name": "Gold", "value": "2,500.00", "change": "+0.20%", "direction": "up"}]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "market-live.json"
            path.write_text(
                json.dumps(
                    {
                        "report_date": "2026-09-01",
                        "captured_at": "2026-09-01T10:30:00+08:00",
                        "timezone": "Asia/Taipei",
                        "market": market,
                    }
                ),
                encoding="utf-8",
            )
            loaded, meta = _load_live_market(date(2026, 9, 1), path)
            self.assertEqual(loaded, market)
            self.assertEqual(meta["mode"], "live")
            self.assertEqual(meta["captured_at"], "2026-09-01T10:30:00+08:00")
            other, _ = _load_live_market(date(2026, 9, 2), path)
            self.assertEqual(other, [])

    def test_reader_summary_hides_engine_implementation(self):
        report = {
            "date": "2026-09-01",
            "world_summary": "Tavily deterministic OpenAI API implementation details",
            "quality": {"notes": ["technical"]},
            "top5_ids": ["a", "b", "c", "d", "e"],
            "signals": [
                {
                    "id": "a",
                    "categories": ["economy", "markets"],
                    "winners_losers": "Deterministic 模式不推論。",
                    "quality_note": "Tavily-only deterministic mode",
                },
                {"id": "b", "categories": ["taiwan"]},
                {"id": "c", "categories": ["geopolitics"]},
                {"id": "d", "categories": ["technology"]},
                {"id": "e", "categories": ["world"]},
            ],
        }
        enriched = enrich_report(report)
        summary = enriched["world_summary"].lower()
        self.assertNotIn("tavily", summary)
        self.assertNotIn("deterministic", summary)
        self.assertNotIn("openai", summary)
        self.assertIn("經濟與市場", enriched["world_summary"])
        self.assertIn("台灣", enriched["world_summary"])
        self.assertEqual(
            enriched["signals"][0]["winners_losers"],
            "目前可驗證來源不足以可靠判定明確受益與受損方。",
        )


if __name__ == "__main__":
    unittest.main()

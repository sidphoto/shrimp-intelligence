import os
import sys
import unittest
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from deterministic_report import build_deterministic_report, title_similarity  # noqa: E402

TZ = ZoneInfo("Asia/Taipei")


def item(title, url, source_class, sector, relevance=0.9, mode="trusted_verification"):
    return {
        "title": title,
        "url": url,
        "publisher_domain": url.split("/")[2],
        "content": f"Verified source summary for {title}.",
        "tavily_relevance": relevance,
        "published_at": "2026-09-01T04:00:00+08:00",
        "published_date_raw": "2026-09-01T04:00:00+08:00",
        "cutoff_status": "within",
        "collection_modes": [mode],
        "source_class": source_class,
        "sector": sector,
    }


class DeterministicReportTests(unittest.TestCase):
    def setUp(self):
        os.environ.pop("OPENAI_API_KEY", None)
        self.report_date = date(2026, 9, 1)
        self.start = datetime(2026, 8, 31, 0, 0, tzinfo=TZ)
        self.end = datetime(2026, 9, 1, 6, 0, tzinfo=TZ)

    def test_similar_titles_cluster(self):
        self.assertGreater(
            title_similarity(
                "NATO issues new security warning after drone incident",
                "NATO issues security warning following drone incident",
            ),
            0.62,
        )

    def test_builds_report_without_openai_key(self):
        packets = [
            {"items": [item("NATO security warning", "https://www.nato.int/a", "PRIMARY", "world_geo")]},
            {"items": [item("Federal Reserve policy update", "https://www.federalreserve.gov/a", "PRIMARY", "economy_market")]},
            {"items": [item("NVIDIA AI infrastructure announcement", "https://www.nvidia.com/a", "PRIMARY", "ai_tech")]},
            {"items": [item("Reuters reports major energy disruption", "https://www.reuters.com/a", "CONFIRMED", "industry_science")]},
            {"items": [item("Taiwan economic policy announcement", "https://www.moea.gov.tw/a", "PRIMARY", "taiwan")]},
            {"items": [item("Industry analysis only", "https://example.com/a", "ANALYSIS", "business_transformation", 0.95, "discovery")]},
        ]

        report = build_deterministic_report(
            packets, self.report_date, self.start, self.end
        )

        self.assertEqual(report["engine_version"], "m2.4-tavily-deterministic-v1")
        self.assertEqual(len(report["top5_ids"]), 5)
        self.assertIn("不使用 OpenAI API", report["world_summary"])
        by_id = {signal["id"]: signal for signal in report["signals"]}
        for signal_id in report["top5_ids"]:
            signal = by_id[signal_id]
            self.assertTrue(signal["window_verified"])
            self.assertTrue(
                any(
                    source["class"] in ("PRIMARY", "CONFIRMED")
                    for source in signal["sources"]
                )
            )

        analysis = next(s for s in report["signals"] if s["title"] == "Industry analysis only")
        self.assertLessEqual(analysis["score"], 79)
        self.assertNotIn(analysis["id"], report["top5_ids"])


if __name__ == "__main__":
    unittest.main()

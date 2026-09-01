import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from tavily_provider import (  # noqa: E402
    TavilyNewsProvider,
    normalize_published_date,
)

TZ = ZoneInfo("Asia/Taipei")


class FakeTavilyClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def search(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)


class TavilyProviderTests(unittest.TestCase):
    def setUp(self):
        self.start = datetime(2026, 8, 31, 0, 0, tzinfo=TZ)
        self.end = datetime(2026, 9, 1, 6, 0, tzinfo=TZ)

    def test_normalizes_exact_timestamp_and_rejects_post_cutoff(self):
        value, status = normalize_published_date(
            "2026-09-01T05:30:00+08:00", self.start, self.end
        )
        self.assertEqual(status, "within")
        self.assertTrue(value.endswith("+08:00"))

        value, status = normalize_published_date(
            "2026-09-01T06:00:01+08:00", self.start, self.end
        )
        self.assertEqual(status, "out")

    def test_date_only_metadata_is_fail_closed_on_cutoff_day(self):
        value, status = normalize_published_date(
            "2026-08-31", self.start, self.end
        )
        self.assertIsNone(value)
        self.assertEqual(status, "within")

        value, status = normalize_published_date(
            "2026-09-01", self.start, self.end
        )
        self.assertIsNone(value)
        self.assertEqual(status, "uncertain")

    def test_sector_collection_dedupes_and_marks_trusted_verification(self):
        discovery = {
            "results": [
                {
                    "title": "Major policy event",
                    "url": "https://www.reuters.com/world/example",
                    "content": "Discovery snippet",
                    "score": 0.81,
                    "published_date": "2026-09-01T03:30:00+08:00",
                },
                {
                    "title": "Post-cutoff event",
                    "url": "https://example.com/late",
                    "content": "This must be filtered.",
                    "score": 0.95,
                    "published_date": "2026-09-01T08:00:00+08:00",
                },
            ]
        }
        verification = {
            "results": [
                {
                    "title": "Major policy event",
                    "url": "https://www.reuters.com/world/example",
                    "content": "Longer trusted verification snippet",
                    "score": 0.91,
                    "published_date": "2026-09-01T03:30:00+08:00",
                }
            ]
        }
        fake = FakeTavilyClient([discovery, verification])
        provider = TavilyNewsProvider(client=fake, min_relevance_score=0.2)

        packet = provider.collect_sector(
            sector_key="world_geo",
            spec={
                "label": "World / Geo",
                "topics": ["major geopolitical developments"],
                "allowed_domains": ["reuters.com", "apnews.com"],
            },
            blocked_domains=["reddit.com"],
            start=self.start,
            end=self.end,
        )

        self.assertEqual(len(fake.calls), 2)
        self.assertNotIn("include_domains", fake.calls[0])
        self.assertEqual(fake.calls[1]["include_domains"], ["reuters.com", "apnews.com"])
        self.assertEqual(len(packet["items"]), 1)
        item = packet["items"][0]
        self.assertEqual(item["cutoff_status"], "within")
        self.assertEqual(
            item["collection_modes"], ["discovery", "trusted_verification"]
        )
        self.assertEqual(item["tavily_relevance"], 0.91)
        self.assertIn("trusted verification", item["content"].lower())


if __name__ == "__main__":
    unittest.main()

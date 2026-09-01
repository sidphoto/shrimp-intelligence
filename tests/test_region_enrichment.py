import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from enrich_regions import enrich_report_regions, infer_regions  # noqa: E402


class RegionEnrichmentTests(unittest.TestCase):
    def test_infers_japan_and_us(self):
        signal = {
            "title": "Bank of Japan signals action as US markets react",
            "regions": ["global"],
        }
        regions = infer_regions(signal)
        self.assertIn("global", regions)
        self.assertIn("japan", regions)
        self.assertIn("us", regions)

    def test_infers_middle_east(self):
        signal = {"title": "Oil rises after Iran tensions near Hormuz", "regions": []}
        self.assertIn("middle-east", infer_regions(signal))

    def test_preserves_existing_regions(self):
        signal = {"title": "Technology update", "regions": ["taiwan"]}
        self.assertEqual(infer_regions(signal), ["taiwan"])

    def test_report_marks_tagging_version(self):
        report = {"signals": [{"title": "Vietnam manufacturing outlook", "regions": ["global"]}]}
        enriched = enrich_report_regions(report)
        self.assertEqual(enriched["region_tagging_version"], "m4-keyword-v1")
        self.assertIn("vietnam", enriched["signals"][0]["regions"])


if __name__ == "__main__":
    unittest.main()

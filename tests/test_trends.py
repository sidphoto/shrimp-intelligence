import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_trends import build_emerging_signals  # noqa: E402


def signal(signal_id, title, source_class="CONFIRMED"):
    return {
        "id": signal_id,
        "title": title,
        "score": 88,
        "source_class": source_class,
        "source_label": "reuters.com",
        "categories": ["geopolitics", "markets"],
        "regions": ["global"],
        "what_happened": title,
        "sources": [
            {
                "class": source_class,
                "name": "reuters.com",
                "url": f"https://www.reuters.com/{signal_id}",
            }
        ],
        "emerging_signal": False,
        "emerging_reason": "",
    }


class TrendEngineTests(unittest.TestCase):
    def config(self, path):
        payload = {
            "version": 1,
            "min_history_days": 2,
            "full_window_days": 7,
            "max_emerging_signals": 4,
            "entities": [
                {
                    "id": "iran-energy-risk",
                    "icon": "oil",
                    "labels": {"zh-TW": "伊朗與能源風險", "en": "Iran energy"},
                    "all_groups": [["iran"], ["oil", "strike"]],
                    "any_phrases": ["hormuz"],
                }
            ],
        }
        path.write_text(json.dumps(payload), encoding="utf-8")

    def test_single_full_day_never_fabricates_trend(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            config = tmp / "trend.json"
            self.config(config)
            report = {
                "date": "2026-09-01",
                "signals": [signal("a", "Iran oil risk rises"), signal("b", "Iran strike raises oil concern")],
            }
            build_emerging_signals(report, data_dir=tmp, config_path=config)
            self.assertEqual(report["emerging_signals"], [])
            self.assertEqual(report["trend_meta"]["status"], "collecting_history")
            self.assertEqual(report["trend_meta"]["available_history_days"], 1)

    def test_two_day_acceleration_creates_preliminary_signal(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            config = tmp / "trend.json"
            self.config(config)
            prior = {
                "date": "2026-08-31",
                "signals": [signal("prior", "Iran oil risk")],
            }
            (tmp / "2026-08-31.json").write_text(json.dumps(prior), encoding="utf-8")
            current = {
                "date": "2026-09-01",
                "signals": [
                    signal("a", "Iran oil risk rises"),
                    signal("b", "Iran strike raises oil concern"),
                    signal("c", "Hormuz shipping risk grows"),
                ],
            }
            build_emerging_signals(current, data_dir=tmp, config_path=config)
            self.assertEqual(len(current["emerging_signals"]), 1)
            trend = current["emerging_signals"][0]
            self.assertEqual(trend["series"], [1, 3])
            self.assertEqual(trend["status"], "preliminary")
            self.assertGreaterEqual(trend["trend_score"], 55)
            self.assertTrue(all(item["emerging_signal"] for item in current["signals"]))

    def test_archive_pointer_without_signals_is_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            config = tmp / "trend.json"
            self.config(config)
            (tmp / "2026-08-31.json").write_text(json.dumps({"$ref": "./latest.json"}), encoding="utf-8")
            current = {"date": "2026-09-01", "signals": [signal("a", "Iran oil risk rises")]}
            build_emerging_signals(current, data_dir=tmp, config_path=config)
            self.assertEqual(current["trend_meta"]["available_history_days"], 1)


if __name__ == "__main__":
    unittest.main()

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_impact_chains import build_impact_chains  # noqa: E402


class ImpactChainTests(unittest.TestCase):
    def test_supported_first_edge_and_potential_downstream(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            config = tmp / "impact.json"
            config.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "max_chains": 3,
                        "rules": [
                            {
                                "id": "alpha-energy",
                                "priority": 100,
                                "title": {"zh-TW": "示範能源鏈", "en": "Demo energy chain"},
                                "trigger": {
                                    "all_groups": [["alpha"], ["energy", "constraint"]],
                                    "any_phrases": ["corridor"],
                                },
                                "nodes": [
                                    {"id": "event", "icon": "1", "type": "event", "labels": {"zh-TW": "事件", "en": "Event"}},
                                    {"id": "energy", "icon": "2", "type": "risk", "labels": {"zh-TW": "能源", "en": "Energy"}},
                                    {"id": "market", "icon": "3", "type": "market", "labels": {"zh-TW": "市場", "en": "Market"}},
                                ],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            report = {
                "signals": [
                    {
                        "id": "s1",
                        "title": "Alpha constraint pushes energy risk higher",
                        "what_happened": "Alpha corridor constraint and energy supply concerns",
                        "score": 90,
                        "source_class": "CONFIRMED",
                        "sources": [{"class": "CONFIRMED", "url": "https://example.invalid/a"}],
                    }
                ]
            }
            build_impact_chains(report, config_path=config)
            self.assertEqual(len(report["impact_chains"]), 1)
            chain = report["impact_chains"][0]
            self.assertEqual(chain["edges"][0]["relation"], "SUPPORTED")
            self.assertEqual(chain["edges"][1]["relation"], "POTENTIAL")
            self.assertEqual(chain["edges"][0]["evidence_signal_ids"], ["s1"])
            self.assertEqual(report["featured_impact_chain_id"], "alpha-energy")
            self.assertEqual(report["impact_chain"][0]["label"], "事件")
            self.assertGreater(chain["confidence"], 0.7)

    def test_no_match_creates_no_chain(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            config = tmp / "impact.json"
            config.write_text(
                json.dumps(
                    {
                        "max_chains": 3,
                        "rules": [
                            {
                                "id": "alpha",
                                "priority": 1,
                                "title": {"zh-TW": "示範"},
                                "trigger": {"all_groups": [["alpha"], ["energy"]]},
                                "nodes": [
                                    {"id": "a", "labels": {"zh-TW": "A"}},
                                    {"id": "b", "labels": {"zh-TW": "B"}},
                                ],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            report = {"signals": [{"id": "x", "title": "Example unrelated outlook", "score": 88, "source_class": "CONFIRMED"}]}
            build_impact_chains(report, config_path=config)
            self.assertEqual(report["impact_chains"], [])
            self.assertEqual(report["impact_chain"], [])
            self.assertIsNone(report["featured_impact_chain_id"])


if __name__ == "__main__":
    unittest.main()

import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import validate_i18n  # noqa: E402


class I18nContractTests(unittest.TestCase):
    def test_locale_key_parity_and_non_empty_strings(self):
        validate_i18n.validate_locale_files()

    def test_overlay_machine_field_mutation_is_rejected(self):
        canonical = json.loads((ROOT / "data" / "latest.json").read_text(encoding="utf-8"))
        signal_id = canonical["signals"][0]["id"]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "latest.json"
            path.write_text(
                json.dumps(
                    {
                        "locale": "en",
                        "signals": {
                            signal_id: {
                                "title": "Localized title",
                                "score": 100,
                            }
                        },
                    }
                ),
                encoding="utf-8",
            )
            original_data_dir = validate_i18n.DATA_DIR
            try:
                validate_i18n.DATA_DIR = ROOT / "data"
                with self.assertRaises(AssertionError):
                    validate_i18n.validate_overlay(path, "en")
            finally:
                validate_i18n.DATA_DIR = original_data_dir

    def test_overlay_localizable_fields_are_allowed(self):
        canonical = json.loads((ROOT / "data" / "latest.json").read_text(encoding="utf-8"))
        signal_id = canonical["signals"][0]["id"]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "latest.json"
            path.write_text(
                json.dumps(
                    {
                        "locale": "vi-VN",
                        "world_summary": "Bản tóm tắt",
                        "signals": {
                            signal_id: {
                                "title": "Tiêu đề",
                                "why_important": "Vì sao quan trọng",
                            }
                        },
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            validate_i18n.validate_overlay(path, "vi-VN")


if __name__ == "__main__":
    unittest.main()

import sys
import unittest
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_report import (  # noqa: E402
    RadarDraft,
    SignalDraft,
    Source,
    build_window,
    compute_report_date,
    parse_time,
    verify_and_normalize,
)

TZ = ZoneInfo("Asia/Taipei")


class CutoffRegressionTests(unittest.TestCase):
    def test_before_0600_uses_previous_day_window(self):
        now = datetime(2026, 9, 1, 5, 59, tzinfo=TZ)
        report_date = compute_report_date(now)
        self.assertEqual(report_date, date(2026, 8, 31))

        start, end = build_window(report_date)
        self.assertEqual(start, datetime(2026, 8, 30, 0, 0, tzinfo=TZ))
        self.assertEqual(end, datetime(2026, 8, 31, 6, 0, tzinfo=TZ))

    def test_rejects_timezone_naive_timestamps(self):
        with self.assertRaises(ValueError):
            parse_time("2026-09-01T07:00:00")

        draft = RadarDraft(
            world_summary="World summary",
            signals=[
                SignalDraft(
                    title="Naive timestamp leak test",
                    score=92,
                    source_class="PRIMARY",
                    source_label="Official statement",
                    categories=["geopolitics"],
                    regions=["global"],
                    what_happened="A burst of activity happened on the wrong side of the cutoff.",
                    why_now="It matters now.",
                    why_important="It is important.",
                    winners_losers="Winners and losers are still uncertain.",
                    taiwan_impact="Taiwan impact is limited.",
                    what_next="Monitor further information.",
                    impact_chain=[],
                    sources=[
                        Source(
                            source_class="PRIMARY",
                            name="Official source",
                            url="https://example.com/official",
                            published_at="2026-09-01T07:00:00",
                            cutoff_status="within",
                            note="This is timestamped without timezone and should be rejected.",
                        )
                    ],
                    observed_at="2026-09-01T07:00:00",
                    window_verified=True,
                )
            ],
        )
        start = datetime(2026, 8, 31, 0, 0, tzinfo=TZ)
        end = datetime(2026, 9, 1, 6, 0, tzinfo=TZ)

        with self.assertRaises(RuntimeError):
            verify_and_normalize(draft, date(2026, 9, 1), start, end)


if __name__ == "__main__":
    unittest.main()

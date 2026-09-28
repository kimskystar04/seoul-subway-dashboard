import json
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

import analyze  # noqa: E402


class TestLoadRaw(unittest.TestCase):
    def test_load_raw_does_not_shift_columns(self):
        df = analyze.load_raw(analyze.DEFAULT_RAW)
        first = df.iloc[0]
        # first real data row of the CSV: 20260801,중앙선,양원,1912,1927,20260804
        self.assertEqual(first["노선명"], "중앙선")
        self.assertEqual(first["역명"], "양원")
        self.assertEqual(int(first["승차총승객수"]), 1912)
        self.assertEqual(int(first["하차총승객수"]), 1927)

    def test_no_missing_or_negative_values(self):
        df = analyze.load_raw(analyze.DEFAULT_RAW)
        self.assertEqual(int(df.isna().sum().sum()), 0)
        self.assertTrue((df["승차총승객수"] >= 0).all())
        self.assertTrue((df["하차총승객수"] >= 0).all())


class TestSummaryAgainstBaseline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.baseline = json.loads(analyze.DEFAULT_BASELINE.read_text(encoding="utf-8"))
        cls.df = analyze.load_raw(analyze.DEFAULT_RAW)
        cls.summary = analyze.build_summary(cls.df)
        cls.top_stations = analyze.build_top_stations(cls.df, n=10)

    def test_valid_rows(self):
        self.assertEqual(self.summary["valid_rows"], self.baseline["summary"]["valid_rows"])

    def test_total_boardings_and_alightings(self):
        self.assertEqual(self.summary["total_boardings"], self.baseline["summary"]["total_boardings"])
        self.assertEqual(self.summary["total_alightings"], self.baseline["summary"]["total_alightings"])

    def test_total_usage(self):
        self.assertEqual(self.summary["total_usage"], self.baseline["summary"]["total_usage"])

    def test_weekday_weekend_day_counts(self):
        self.assertEqual(self.summary["weekday_day_count"], self.baseline["summary"]["weekday_day_count"])
        self.assertEqual(self.summary["weekend_day_count"], self.baseline["summary"]["weekend_day_count"])

    def test_weekday_weekend_averages(self):
        self.assertAlmostEqual(
            self.summary["weekday_daily_average"], self.baseline["summary"]["weekday_daily_average"], places=2
        )
        self.assertAlmostEqual(
            self.summary["weekend_daily_average"], self.baseline["summary"]["weekend_daily_average"], places=2
        )

    def test_top_3_stations(self):
        self.assertEqual(self.top_stations[:3], self.baseline["top_stations_first3"])

    def test_compare_to_baseline_reports_no_errors(self):
        errors = analyze.compare_to_baseline(self.summary, self.top_stations, self.baseline)
        self.assertEqual(errors, [])


class TestHashValidation(unittest.TestCase):
    def test_hash_mismatch_aborts(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            bad_csv = tmp_path / "bad.csv"
            bad_csv.write_text("사용일자,노선명,역명,승차총승객수,하차총승객수,등록일자\n", encoding="utf-8")

            bad_baseline = tmp_path / "baseline.json"
            baseline = json.loads(analyze.DEFAULT_BASELINE.read_text(encoding="utf-8"))
            bad_baseline.write_text(json.dumps(baseline), encoding="utf-8")

            out_path = tmp_path / "dashboard_data.json"
            with self.assertRaises(SystemExit):
                analyze.run(bad_csv, bad_baseline, out_path)
            self.assertFalse(out_path.exists())


class TestIntegration(unittest.TestCase):
    def test_run_writes_expected_json_to_temp_dir(self):
        tracked_json = analyze.DEFAULT_OUT
        tracked_before = tracked_json.read_bytes() if tracked_json.exists() else None

        with tempfile.TemporaryDirectory() as tmp:
            out_path = Path(tmp) / "dashboard_data.json"
            payload = analyze.run(analyze.DEFAULT_RAW, analyze.DEFAULT_BASELINE, out_path)

            self.assertTrue(out_path.exists())
            self.assertIn("metadata", payload)
            self.assertIn("summary", payload)
            self.assertIn("top_stations", payload)
            self.assertIn("records", payload)
            self.assertEqual(len(payload["records"]), payload["summary"]["valid_rows"])

            on_disk = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(on_disk["summary"]["total_usage"], payload["summary"]["total_usage"])

        # integration test must not mutate the tracked dashboard_data.json
        tracked_after = tracked_json.read_bytes() if tracked_json.exists() else None
        self.assertEqual(tracked_before, tracked_after)


if __name__ == "__main__":
    unittest.main()

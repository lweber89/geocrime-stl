"""Tests for merging a month into the master dataset."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from geocrime_stl.utils.dataset import load_master, merge_month
from tests.test_web_export import make_df


class MergeMonthTests(unittest.TestCase):
    def test_first_month_into_empty_master(self):
        out = merge_month(pd.DataFrame(), make_df(months=("2026-01",), per_month=3), month=1, year=2026)
        self.assertEqual(len(out), 3)

    def test_replaces_only_the_target_month(self):
        master = make_df(months=("2026-01", "2026-02", "2026-03"), per_month=5)
        new = make_df(months=("2026-02",), per_month=7)
        out = merge_month(master, new, month=2, year=2026)
        counts = pd.to_datetime(out["date_time"]).dt.strftime("%Y-%m").value_counts().to_dict()
        self.assertEqual(counts, {"2026-01": 5, "2026-02": 7, "2026-03": 5})

    def test_rerunning_a_month_does_not_duplicate(self):
        master = make_df(months=("2026-01", "2026-02"), per_month=5)
        once = merge_month(master, make_df(months=("2026-02",), per_month=5), month=2, year=2026)
        twice = merge_month(once, make_df(months=("2026-02",), per_month=5), month=2, year=2026)
        self.assertEqual(len(once), len(twice))

    def test_new_month_is_appended_in_order(self):
        master = make_df(months=("2026-01", "2026-02"), per_month=3)
        out = merge_month(master, make_df(months=("2026-03",), per_month=3), month=3, year=2026)
        months = pd.to_datetime(out["date_time"]).dt.strftime("%Y-%m").tolist()
        self.assertEqual(months, sorted(months))
        self.assertEqual(len(out), 9)

    def test_same_month_in_another_year_is_kept(self):
        master = make_df(months=("2025-02", "2026-02"), per_month=4)
        out = merge_month(master, make_df(months=("2026-02",), per_month=6), month=2, year=2026)
        self.assertEqual(len(out), 10)

    def test_load_master_returns_empty_when_file_missing(self):
        self.assertTrue(load_master(Path(tempfile.gettempdir()) / "definitely_missing.parquet").empty)


@unittest.skipUnless(importlib.util.find_spec("pyarrow") and importlib.util.find_spec("geopandas"),
                     "needs pyarrow and geopandas")
class RoundTripTests(unittest.TestCase):
    def test_save_then_load_round_trips(self):
        from geocrime_stl.utils.dataset import save_master
        df = make_df(months=("2026-01",), per_month=4)
        with tempfile.TemporaryDirectory() as tmp:
            pq, gj = Path(tmp) / "m.parquet", Path(tmp) / "m.geojson"
            save_master(df, pq, gj)
            back = load_master(pq)
            self.assertEqual(len(back), 4)
            self.assertNotIn("geometry", back.columns)
            self.assertTrue(gj.exists())


if __name__ == "__main__":
    unittest.main()

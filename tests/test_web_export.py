"""Tests for the dashboard feed builder. Run with:  python -m unittest discover -s tests  (or pytest)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from geocrime_stl.utils.web_export import WebExportError, build_web_feed


def make_df(months=("2026-01", "2026-02", "2026-03", "2026-04", "2026-05"), per_month=10, **overrides):
    """A small valid frame: ``per_month`` rows in each month, all inside the city."""
    rows = []
    for m in months:
        for i in range(per_month):
            rows.append({
                "inc_#": f"{m.replace('-', '')}{i:03d}", "date_time": f"{m}-{(i % 27) + 1:02d}T{(i % 20) + 1:02d}:{(i * 7) % 60:02d}:00",
                "nibrs_cat": "Simple Assault" if i % 2 else "Shoplifting", "nibrs_code": "13B", "offense": "ASSAULT",
                "inc_desc": "x", "off_type": "Person" if i % 2 else "Property", "firearm": "Yes" if i % 5 == 0 else "No",
                "address": f"{100 + i} MAIN ST", "nbhd": "Downtown", "nbhd_num": 35, "district": "4",
                "lat": 38.63 + i * 0.001, "lon": -90.2 - i * 0.001,
            })
    df = pd.DataFrame(rows)
    for col, value in overrides.items():
        df[col] = value
    return df


class WardTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.out = Path(self._tmp.name) / "web"

    def test_ward_codes_and_outlines(self):
        df = make_df(months=("2026-01",), per_month=4)
        df["ward"] = pd.array([3, 14, None, 3], dtype="Int64")
        manifest = build_web_feed(df, self.out, force=True)
        f = json.loads((self.out / "2026-01.json").read_text(encoding="utf-8"))
        wards = f["d"]["ward"]
        self.assertEqual(wards, [str(n) for n in range(1, 15)], "same 14 wards, in numeric order, in every file")
        labels = [wards[r[12]] if r[12] >= 0 else None for r in f["r"]]
        self.assertEqual(labels, ["3", "14", None, "3"])
        self.assertEqual(manifest["noWard"], 1)
        outlines = json.loads((self.out / "wards.geojson").read_text(encoding="utf-8"))
        self.assertEqual(len(outlines["features"]), 14)
        self.assertTrue(all(ft["properties"]["pop"] > 0 for ft in outlines["features"]))
        self.assertEqual(sum(ft["properties"]["pop"] for ft in outlines["features"]), 301578)

    def test_neighborhood_outlines_use_the_names_in_the_data(self):
        build_web_feed(make_df(months=("2026-01",), per_month=3), self.out, force=True)
        shapes = json.loads((self.out / "neighborhoods.geojson").read_text(encoding="utf-8"))
        self.assertEqual(len(shapes["features"]), 88, "89 neighborhoods in the City file, one has no outline")
        by_id = {f["properties"]["id"]: f["properties"] for f in shapes["features"]}
        self.assertEqual(by_id[35]["name"], "Downtown", "test data says neighborhood 35 is 'Downtown'")
        self.assertEqual(sum(p["pop"] for p in by_id.values()), 301562, "301,578 city total minus 16 residents of the outline-less placeholder")

    def test_unassigned_district_rows_get_no_ward(self):
        df = make_df(months=("2026-01",), per_month=3)
        df["ward"] = 5
        df["district"] = "0"
        build_web_feed(df, self.out, force=True)
        f = json.loads((self.out / "2026-01.json").read_text(encoding="utf-8"))
        self.assertTrue(all(r[12] == -1 for r in f["r"]))


class WebExportTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.out = Path(self._tmp.name) / "web"

    def load_month(self, m):
        return json.loads((self.out / f"{m}.json").read_text(encoding="utf-8"))

    def test_writes_manifest_and_month_files(self):
        manifest = build_web_feed(make_df(), self.out)
        self.assertEqual([m["m"] for m in manifest["months"]], ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"])
        self.assertEqual(manifest["rows"], 50)
        self.assertEqual(manifest["completeThrough"], "2026-05")
        on_disk = json.loads((self.out / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(on_disk["rows"], 50)
        self.assertEqual(len(self.load_month("2026-03")["r"]), 10)
        self.assertFalse(self.out.with_name("web.tmp").exists(), "temp folder should be gone")

    def test_row_layout_matches_the_dashboard_loader(self):
        build_web_feed(make_df(months=("2026-01",), per_month=3), self.out)
        f = self.load_month("2026-01")
        self.assertEqual(set(f["d"]), {"type", "cat", "off", "nbhd", "ward"})
        row = f["r"][0]
        self.assertEqual(len(row), 14)
        inc, t, lat, lon, addr, ty, ca, of, nb, district, firearm, est, ward, masked = row
        self.assertEqual(ward, -1, "no ward column in the input -> no ward")
        self.assertEqual(f["d"]["type"][ty], "Property")
        self.assertEqual(f["d"]["nbhd"][nb], "Downtown")
        self.assertRegex(t, r"^2026-01-\d\d T\d\d:\d\d$".replace(" ", ""))
        self.assertIn(firearm, (0, 1))

    def test_unassigned_district_has_no_coordinates(self):
        df = make_df(months=("2026-01",), per_month=3)
        df.loc[0, "district"] = "0"
        build_web_feed(df, self.out)
        rows = self.load_month("2026-01")["r"]
        unmapped = [r for r in rows if r[2] is None]
        self.assertEqual(len(unmapped), 1)
        self.assertEqual(unmapped[0][9], "0")
        self.assertEqual(self.load_month("2026-01")["d"]["nbhd"].count("Unknown"), 1)

    def test_out_of_bounds_points_are_unmapped(self):
        df = make_df(months=("2026-01",), per_month=3)
        df.loc[1, ["lat", "lon"]] = [40.0, -75.0]
        manifest = build_web_feed(df, self.out)
        self.assertEqual(manifest["unmapped"], 1)

    def test_geocoding_jitter_is_snapped_but_distinct_places_are_not(self):
        df = make_df(months=("2026-01",), per_month=4)
        df["address"] = ["1 A ST", "1 A ST", "1 A ST", "9 FAR ST"]
        df["lat"] = [38.6300, 38.6300, 38.63009, 38.6500]     # third is ~10 m off the mode
        df["lon"] = [-90.2000, -90.2000, -90.2000, -90.2000]
        build_web_feed(df, self.out)
        pts = {(r[4], r[2]) for r in self.load_month("2026-01")["r"]}
        self.assertEqual(pts, {("1 A ST", 38.63), ("9 FAR ST", 38.65)})

    def test_same_label_far_apart_is_left_alone(self):
        df = make_df(months=("2026-01",), per_month=3)
        df["address"] = "I-44 W"
        df["lat"] = [38.60, 38.60, 38.70]                      # ~11 km apart
        build_web_feed(df, self.out)
        lats = sorted(r[2] for r in self.load_month("2026-01")["r"])
        self.assertEqual(lats, [38.6, 38.6, 38.7])

    def test_placeholder_times_are_flagged(self):
        df = make_df(months=("2026-01",), per_month=3)
        df["date_time"] = ["2026-01-05T00:00:00", "2026-01-05T12:00:00", "2026-01-05T12:01:00"]
        build_web_feed(df, self.out)
        self.assertEqual([r[11] for r in self.load_month("2026-01")["r"]], [1, 1, 0])

    def test_unknown_offense_type_becomes_other(self):
        df = make_df(months=("2026-01",), per_month=2)
        df["off_type"] = "Weird"
        build_web_feed(df, self.out)
        self.assertEqual(self.load_month("2026-01")["d"]["type"], ["Other"])

    def test_missing_columns_raise(self):
        with self.assertRaises(WebExportError):
            build_web_feed(make_df().drop(columns=["nibrs_cat"]), self.out)

    def test_empty_input_raises(self):
        with self.assertRaises(WebExportError):
            build_web_feed(make_df().iloc[0:0], self.out)

    def test_gap_in_months_raises_even_with_force(self):
        df = make_df(months=("2026-01", "2026-02", "2026-04"))
        with self.assertRaises(WebExportError):
            build_web_feed(df, self.out, force=True)

    def test_partial_newest_month_is_refused_unless_forced(self):
        df = pd.concat([make_df(per_month=10), make_df(months=("2026-06",), per_month=2)], ignore_index=True)
        with self.assertRaises(WebExportError):
            build_web_feed(df, self.out)
        self.assertEqual(build_web_feed(df, self.out, force=True)["completeThrough"], "2026-06")

    def test_large_drop_in_rows_is_refused_and_leaves_old_feed_alone(self):
        build_web_feed(make_df(per_month=10), self.out)
        before = (self.out / "manifest.json").read_text(encoding="utf-8")
        with self.assertRaises(WebExportError):
            build_web_feed(make_df(per_month=5), self.out)
        self.assertEqual((self.out / "manifest.json").read_text(encoding="utf-8"), before)
        self.assertEqual(len(self.load_month("2026-01")["r"]), 10)

    def test_rebuild_replaces_old_files(self):
        build_web_feed(make_df(), self.out)
        build_web_feed(make_df(months=("2026-02", "2026-03", "2026-04", "2026-05")), self.out, force=True)
        self.assertFalse((self.out / "2026-01.json").exists())

    def test_row_ids_are_stable_across_rebuilds(self):
        df = make_df()
        build_web_feed(df, self.out)
        first = self.load_month("2026-02")["r"]
        build_web_feed(df.sample(frac=1, random_state=1).reset_index(drop=True), self.out)
        self.assertEqual(self.load_month("2026-02")["r"], first)


if __name__ == "__main__":
    unittest.main()


class MaskingTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.out = Path(self._tmp.name) / "web"

    def test_sensitive_rows_lose_address_and_exact_location_but_stay_counted(self):
        df = make_df(months=("2026-01",), per_month=4)
        df["nibrs_cat"] = ["Rape", "Kidnapping/Abduction", "Family Offenses, Nonviolent", "Simple Assault"]
        df["ward"] = 5
        manifest = build_web_feed(df, self.out, force=True)
        f = json.loads((self.out / "2026-01.json").read_text(encoding="utf-8"))
        self.assertEqual(len(f["r"]), 4, "masked rows stay in the counts")
        self.assertEqual([r[13] for r in f["r"]], [1, 1, 1, 0])
        for r, (la, lo) in zip(f["r"][:3], zip(df["lat"][:3], df["lon"][:3])):
            self.assertEqual(r[4], "", "no street address")
            self.assertIsNotNone(r[2])
            self.assertLess(abs(r[2] - la), 0.0013, "moved to the middle of a ~250 m cell")
            self.assertNotEqual(r[2], round(la, 5))
            self.assertEqual(f["d"]["ward"][r[12]], "5", "ward is kept")
        self.assertEqual(f["r"][3][4], "103 MAIN ST")
        self.assertEqual(manifest["masked"], 3)
        self.assertIn("Kidnapping/Abduction", manifest["maskedCategories"])
        self.assertEqual(manifest["schema"], 3)

    def test_unseen_category_is_reported(self):
        df = make_df(months=("2026-01",), per_month=4)
        df["nibrs_cat"] = ["Simple Assault", "Shoplifting", "Brand New Offense", "Rape"]
        with self.assertLogs("geocrime_stl.utils.web_export", level="WARNING") as cm:
            manifest = build_web_feed(df, self.out, force=True)
        self.assertEqual(manifest["newCategories"], ["Brand New Offense"])
        self.assertTrue(any("Brand New Offense" in line for line in cm.output))

    def test_masked_categories_are_all_known(self):
        from geocrime_stl.utils.web_export import KNOWN_CATEGORIES, MASKED_CATEGORIES
        self.assertTrue(set(MASKED_CATEGORIES) <= KNOWN_CATEGORIES)

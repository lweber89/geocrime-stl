"""IncidentDate parsing: the m/d/YYYY files must parse as before, and the ISO-dated early-2024 files must parse too."""

import unittest

import pandas as pd

from geocrime_stl.etl.transform import parse_incident_dates


class ParseIncidentDatesTests(unittest.TestCase):
    def test_us_format(self):
        out = parse_incident_dates(pd.Series(["5/1/2024", "05/31/2024"]))
        self.assertEqual(list(out), [pd.Timestamp("2024-05-01"), pd.Timestamp("2024-05-31")])

    def test_iso_format(self):
        out = parse_incident_dates(pd.Series(["2024-01-05", "2023-12-31"]))
        self.assertEqual(list(out), [pd.Timestamp("2024-01-05"), pd.Timestamp("2023-12-31")])

    def test_mixed_and_bad_values(self):
        out = parse_incident_dates(pd.Series(["1/5/2024", "2024-01-06", "garbage", None]))
        self.assertEqual(out.iloc[0], pd.Timestamp("2024-01-05"))
        self.assertEqual(out.iloc[1], pd.Timestamp("2024-01-06"))
        self.assertTrue(pd.isna(out.iloc[2]) and pd.isna(out.iloc[3]))

    def test_day_first_ambiguity_is_not_swapped(self):
        # 2024-03-04 is March 4th in ISO; it must never be read as 2024 / 3 / 4 in some other order
        self.assertEqual(parse_incident_dates(pd.Series(["2024-03-04"])).iloc[0], pd.Timestamp("2024-03-04"))


if __name__ == "__main__":
    unittest.main()

"""URL building: the normal pattern is unchanged, and the one-off early-2024 files are looked up by exact URL."""

import unittest

from geocrime_stl.etl.extract import construct_url


class ConstructUrlTests(unittest.TestCase):
    def test_normal_month_uses_next_months_upload_folder(self):
        url, m, y = construct_url(5, 2024)
        self.assertEqual((m, y), (5, 2024))
        self.assertEqual(url, "https://slmpd.org/wp-content/uploads/2024/06/May2024.csv")

    def test_december_rolls_into_next_year_folder(self):
        url, _, _ = construct_url("December", 2024)
        self.assertEqual(url, "https://slmpd.org/wp-content/uploads/2025/01/December2024.csv")

    def test_early_2024_months_use_exact_urls(self):
        base = "https://slmpd.org/wp-content/uploads"
        self.assertEqual(construct_url(1, 2024)[0], f"{base}/2024/03/January2024.csv")
        self.assertEqual(construct_url("feb", 2024)[0], f"{base}/2024/03/February2024.csv")
        self.assertEqual(construct_url(3, 2024)[0], f"{base}/2024/05/Downloadable-NIBRS-Crime-File-March-2024-CSV.csv")
        self.assertEqual(construct_url("April", "2024")[0], f"{base}/2024/05/Downloadable-NIBRS-Crime-File-April-2024-CSV.csv")

    def test_same_months_in_other_years_are_not_special(self):
        self.assertEqual(construct_url(1, 2025)[0], "https://slmpd.org/wp-content/uploads/2025/02/January2025.csv")


if __name__ == "__main__":
    unittest.main()

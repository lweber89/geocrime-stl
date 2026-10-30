# Changelog

## Unreleased

- Explorer: the distance around an address or pin is now a slider from ⅛ to 1 mile in steps of an eighth of a mile (the ¼, ½ and 1 mile quick picks remain), and dragging the pin re-centers and re-fits the map around the new spot.
- The public site is now named the **St. Louis Crime Data Explorer** (the address is unchanged).
- The historical download now starts in **January 2024** (it began in May 2024). SLMPD published January-April 2024 under one-off file names, so their exact URLs are listed in `SPECIAL_URLS` in `config.py`, and `construct_url` checks that list first.
- Dates in the January-April 2024 files are ISO (`2024-01-05`) while later files use `m/d/YYYY`; `parse_incident_dates` reads both.
- Explorer: new site icon (a white shield with a star on royal blue).

## 0.2.0

**New: the public crime dashboard** at <https://lweber89.github.io/geocrime-stl/dashboard/> (runs entirely in the browser; no server).

- Crime map with ward and neighborhood shading, a heatmap, address and pin search, and per-location reports.
- Charts page: most common offenses, time of day, day of week, offenses per month, and year over year.
- Hotspots page: 250 m hex cells, plus neighborhood, ward and block rankings, with change versus the previous period.
- Methodology page in plain language.
- Sensitive offenses (sexual offenses, human trafficking, nonviolent family offenses, kidnapping/abduction) are still counted everywhere, but show no address or dot; their location is rounded to a ~250 m cell.
- Based on a project by u/autosoap, used with permission.

**Pipeline**

- `geocrime_stl.utils.web_export` builds the dashboard feed (wards, neighborhoods, city outline, manifest) from the master parquet.
- `save_master` can skip writing the large GeoJSON (`GEOCRIME_WRITE_GEOJSON=0`). The GeoJSON is no longer committed.
- A monthly GitHub Actions workflow downloads the latest SLMPD month (retrying daily from the 10th to the 25th), commits the data, and redeploys the site.
- A warning is logged when SLMPD adds an offense category the dashboard has not seen.

**Changed**

- Minimum Python is now 3.11 (required by the current pandas).
- The GeoLibre data explorer is no longer linked from the docs.

## 0.1.3

Earlier releases: ETL for monthly SLMPD crime files.

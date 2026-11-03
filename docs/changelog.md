# Changelog

## Unreleased

**Explorer (website only; not part of the pip package)**

- The "reported offenses, not a measure of how safe a place is" box under each page title is gone; its sentence now sits in the title line, and the rest is on the Methodology page (which now also notes that times are often rounded to the hour and that hexagon and block counts are not adjusted for population).
- The documentation site (this one) now uses the same shield icon in the browser tab as the Explorer.
- The Methodology page now credits Grant Drawve (geographyofcrime.com) for the crime-mapping practices the Explorer draws on.
- The distance around an address or pin now moves in quarter-mile steps (¼, ½, ¾, 1 mile) instead of eighths. Finer steps made it possible to find a hidden sensitive offense by watching the "not mapped" count change. Older links with an eighth-mile distance move to the nearest quarter.
- The maps (Crime map and Hotspots) now stay on St. Louis: you cannot zoom out past the whole-city view or drag the map far away from the city.
- On Hotspots, the Offenses, Per 1,000 and Change columns for wards and neighborhoods now sort both ways: click a column once for largest first, again for smallest first. Areas with no rate or no change always stay at the bottom.
- The Methodology page notes that neighborhood names appear as the City spells them, without apostrophes (for example, "OFallon").
- Pulling the map off the city and letting go now brings it back to the whole-city view (the same view as Reset), instead of stopping at the edge of the pan limit.
- Charts: the "Show data table" buttons are gone to save space. Each chart still has its numbers as a table that screen readers can read (hidden from the screen).
- The line under each page title now starts with "Data available:" (for example "Data available: Jan 2024 – Sep 2026 · Updated monthly."), so it is no longer mistaken for the period you have chosen.
- When the earlier period had fewer than 10 offenses, a change is now shown as a count ("▲ +3 offenses") instead of a percentage, so small numbers no longer look like big swings (3 to 6 was "+100%"). This applies on the map, Charts and Hotspots.
- Moving or dropping a pin no longer switches the map back to dots when you had chosen the heatmap (or another layer).
- Change figures now read as an arrow and a sign ("▲ +12%", "▼ −8%", "No change") in plain dark text on the map, Charts and Hotspots, the same everywhere. They carry no red or green, so they work for color-blind readers and do not suggest good or bad news. A change that rounds to 0% now says "No change" instead of "+0%" on Charts.

## 0.2.1

**Package**

- **January-April 2024 now download.** SLMPD published those four months under one-off file names, so their exact URLs are listed in `SPECIAL_URLS` in `config.py`, and `construct_url` checks that list first. Coverage now runs from **January 2024** (the repository's historical download script used to start in May 2024).
- **Both date layouts are read.** Dates in the January-April 2024 files are ISO (`2024-01-05`) while later files use `m/d/YYYY`; the new `parse_incident_dates` reads both, trying `m/d/YYYY` first so later months parse exactly as before.
- The offense category "Assisting or Promoting Prostitution" is now on the known list in `web_export`, so the build no longer warns about it. It was reviewed and is not masked.
- Removed the unused `RAW_DIR` setting from `config.py` (raw CSVs are not kept).

**Explorer (website only; already live, not part of the pip package)**

- The public site is now named the **St. Louis Crime Data Explorer** (the address is unchanged).
- The distance around an address or pin is now a slider from ⅛ to 1 mile in steps of an eighth of a mile. It appears once an address or pin is chosen, and dragging the pin re-centers and re-fits the map around the new spot.
- A shorter line under each page title ("Reported offenses, Jan 2024 – Sep 2026 · Updated monthly"), and the routine status message under the address bar is gone, so the page starts with more room. Error messages still appear there, and the report now says which service found an address.
- New site icon (a white shield with a star on royal blue).

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

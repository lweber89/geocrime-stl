# Changelog

## Unreleased

**Explorer (website only; not part of the pip package)**

- In the What menu, arrest-only (Group B) offenses now have their own **Arrest-only** tab next to Person, Property and Society, instead of a tick box at the top. The tab holds the "Include arrest-only offenses" switch and, once it is on, lists their categories (trespass, disorderly conduct, drunk driving and so on) so one can be chosen like any other. The Person/Property/Society tabs now list only Group A categories, and unticking a type no longer hides arrest-only offenses.
- In the What menu, **Violent crime** now stays on while you narrow it: click one of its (tinted) categories to see just that one within violent crime (for example rape without fondling), or untick a type to leave it out. Before, any click switched the shortcut off and applied the click on its own. Categories and types that violent crime does not cover are greyed out until you turn it off or choose All offenses.
- One **What** button now holds the offense filters on every page, after When: quick choices (All offenses; **Violent crime**, the FBI definition), the offense types with a tick box each, the categories under each type with their counts, Firearm, and the arrest-only (Group B) switch. It replaces the category menu, the Firearm and Group B boxes and the Person/Property/Society/Other boxes. Charts and Hotspots now honor the type choices too, so the same offenses are counted on every page, and the choices travel in the page links.
- On Hotspots, a chosen ward or neighborhood is outlined on the map, under the hexagons.
- One **Where** button now holds the place filter on every page, ahead of When, replacing the separate ward and neighborhood menus. It has a grid of wards, a searchable list of neighborhoods, and shows the chosen address or pin with a Clear button. The map's address box is still the main way to look up an address. Choosing a ward clears the neighborhood and the other way round; an address or pin switches both off until cleared.
- Hotspots can now be limited to one ward or neighborhood: the hexagons, blocks and counts follow it and the map zooms to it, while the ward and neighborhood rankings stay citywide. An address or pin carried over from the map is kept in the page links but not used on Hotspots, and a note says so. Links between the pages now carry the ward or neighborhood to Hotspots too.
- On Hotspots, choosing a column to sort by no longer makes the neighboring columns shift sideways; the sort arrow now has a fixed space of its own.
- The "reported offenses, not a measure of how safe a place is" box under each page title is gone; its sentence now sits in the title line, and the rest is on the Methodology page (which now also notes that times are often rounded to the hour and that hexagon and block counts are not adjusted for population).
- The documentation site (this one) now uses the same shield icon in the browser tab as the Explorer.
- The Methodology page now credits Grant Drawve (geographyofcrime.com) for the crime-mapping practices the Explorer draws on.
- The distance around an address or pin now moves in quarter-mile steps (¼, ½, ¾, 1 mile) instead of eighths. Finer steps made it possible to find a hidden sensitive offense by watching the "not mapped" count change. Older links with an eighth-mile distance move to the nearest quarter.
- The maps (Crime map and Hotspots) now stay on St. Louis: you cannot zoom out past the whole-city view or drag the map far away from the city.
- On Hotspots, the Offenses, Per 1,000 and Change columns for wards and neighborhoods now sort both ways: click a column once for largest first, again for smallest first. Areas with no rate or no change always stay at the bottom.
- The Methodology page notes that neighborhood names appear as the City spells them, without apostrophes (for example, "OFallon").
- Pulling the map off the city and letting go now brings it back to the whole-city view (the same view as Reset), instead of stopping at the edge of the pan limit.
- Charts: the "Show data table" buttons are gone to save space. Each chart still has its numbers as a table that screen readers can read (hidden from the screen).
- **Arrest-only (Group B) offenses are now off by default.** NIBRS Group B offenses (trespass, disorderly conduct, drunk driving, curfew and loitering, liquor-law violations, nonviolent family offenses and "All Other Offenses") are recorded only when someone is arrested, so they reflect enforcement more than crime. They are about one in five of the offenses in the data, so the headline numbers, rankings and charts on every page are now lower than before. Tick "Arrest-only offenses (Group B)" (in the link as `gb=1`) to include them. The Methodology page explains the two groups.
- **Domestic violence offenses are now masked** like the other sensitive offenses: still counted in every total, but no street address, no dot on the map, and a location rounded to a cell about 250 meters across. They are found by the offense description (for example "Domestic Assault - 3rd Degree") because the City files them under several categories. Child abuse or neglect and offenses against elderly people are masked the same way. In the August 2026 sample this affects about 4.7% of offenses. The Methodology page lists them.
- **A "When" button replaces the period menus on the map, Hotspots and Charts.** It opens a small panel with quick choices (Latest month, Last 3, 6 and 12 months, Year to date, All data) and a month grid: click a start month, then an end month, to look at any stretch of months. On a phone the panel fills the screen. The period is now shared the same way on every page and is written as `when=` in the link (for example `when=l6` or `when=2026-03..2026-09`); links made before this change still work.
- **Year to date** is now compared with the same months of the previous year (January to September 2026 against January to September 2025), on the map, Charts and Hotspots. Every other period is still compared with the same number of months right before it.
- Charts and Hotspots now carry the period you chose when you move between pages, and the map's whole-city limit of six months still applies on the map.
- The line under each page title now starts with "Data available:" (for example "Data available: Jan 2024 – Sep 2026 · Updated monthly."), so it is no longer mistaken for the period you have chosen.
- When the earlier period had fewer than 10 offenses, a change is now shown as a count ("+3 offenses") instead of a percentage, so small numbers no longer look like big swings (3 to 6 was "+100%"). This applies on the map, Charts and Hotspots.
- Zooming to a ward or neighborhood on the edge of the city (for example wards 4, 8 and 14) now centers it properly. A pan limit added earlier was pushing those off-center, so it is gone; a move that ends with the map off the city still returns to the whole-city view.
- Moving or dropping a pin no longer switches the map back to dots when you had chosen the heatmap (or another layer).
- Change figures are written the same way on the map, Charts and Hotspots: a sign and a number ("+12%", "−8%", "No change") in plain dark text, with no red or green, so they work for color-blind readers and do not suggest good or bad news. A change that rounds to 0% now says "No change" instead of "+0%" on Charts.

**Package**

- `web_export` now has one table of the NIBRS categories (`NIBRS_CATEGORIES`: category, NIBRS code, group, and whether it is part of the FBI's violent crime definition) and publishes it in `manifest.json` as `categories`. The group comes from the NIBRS code, so Group B (codes 90A-90Z) is separate from Persons, Property and Society. The feed rows are unchanged and the schema stays at 3; the dashboard falls back to showing everything if the table is missing.

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

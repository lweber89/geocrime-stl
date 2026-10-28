# St. Louis Crime Data Explorer

The [St. Louis Crime Data Explorer](https://lweber89.github.io/geocrime-stl/dashboard/) is a free, public website built from the same monthly data this package processes. It runs entirely in your browser: there is no server of its own, no account, and no analytics or tracking scripts. Two things do reach outside services: the map loads its tiles from OpenStreetMap and its code libraries from public CDNs (as any web map does), and an address you search for is sent to public geocoding services (the City of St. Louis, OpenStreetMap or the U.S. Census Bureau) to find its location. Dropping a pin sends nothing.

It covers reported offenses inside the City of St. Louis from **January 2024** and is updated each month once SLMPD posts the previous month.

## The pages

**Crime map.** Dots, a heatmap, or shading by ward or neighborhood. Filter by offense, firearm use and period. Search an address or drop a pin to get a report for that spot: recent offenses nearby, a trend, and which ward and neighborhood it is in. While a spot is chosen, the ward and neighborhood menus are locked, and the report links to its ward and neighborhood instead.

**Charts.** The most common offenses, time of day, day of week, offenses per month, and year over year, all for the filters you pick.

**Hotspots.** Where offenses cluster. Hexagonal cells (250 m across) show density, with rankings by neighborhood, ward and street block, and a comparison with the previous equal-length period.

**Methodology.** How the numbers are made, in plain language. Read this before drawing conclusions from any figure.

## Good to know

- **Sharing a view.** The address-bar link holds the whole view (offense, period, ward, pin and so on). Copy it to share exactly what you are looking at, and the Charts and Hotspots pages carry the same filters.
- **Sensitive offenses are counted but not shown on the map.** Sexual offenses, human trafficking, nonviolent family offenses and kidnapping/abduction appear in every total and chart, but have no address or dot; their location is rounded to a cell of about 250 m. The full list is on the Methodology page.
- **"All Other Offenses"** is a catch-all category. It is included in totals but left out of "most common" rankings, because it would otherwise always come first.
- **Times.** Records with a missing time are stored as 00:00; the time-of-day charts leave 00:00 and 12:00 out.
- **Reported, not proven.** The data is offenses reported to police, as published. Counts can be revised later, and a high count is not a measure of how safe any one person is.

## How it is built and updated

The Explorer is plain HTML, CSS, JavaScript and Leaflet (a map library), hosted free on GitHub Pages as part of this documentation site. A GitHub Action runs daily from the 10th to the 25th of each month, downloads the new month, updates the master dataset and redeploys; if the police have not posted by the 25th it fails so the owner is told. See `dashboard/README.md` and `data/README.md` in the repository for the details.

## Credits

The Explorer started from a crash-map project by Reddit user **u/autosoap**, who gave permission to reuse and adapt it. Basemap tiles are from OpenStreetMap contributors.

## Feedback

Please [open an issue](https://github.com/lweber89/geocrime-stl/issues/new/choose). Include the link from your address bar.

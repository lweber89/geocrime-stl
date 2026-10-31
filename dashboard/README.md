# dashboard/

The public website, the **St. Louis Crime Data Explorer**: a static, client-side map and charts (plain HTML, CSS, JavaScript and Leaflet).
It contains **no data**. It reads the feed in `../data/web` (see `../data/README.md`).

## Run it locally

    python -m geocrime_stl.utils.web_export     # build data/web from the master dataset (if needed)
    python scripts/serve.py                     # then open http://localhost:8000

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.js` | The crime map: filters, map, table |
| `radius.js` | The distance choices for an address or pin (1/8 to 1 mile in eighths), shared by the map and Charts; tested in `tests/js/radius.test.js` |
| `data.js` | Loads the feed and gives every page the same clean records (`window.CRIME`) |
| `style.css` | Base layout and styles, adapted from the crash-map project (see Credits) |
| `crime.css` | Colours (offense-type palette) and the few crime-specific rules |
| `favicon.svg` | Site icon: a white shield with a star on royal blue. The docs site uses a copy at `docs/assets/favicon.svg`; if you change this file, copy it there too (the deploy checks they match) |

## Publishing and monthly updates

The site is published with GitHub Pages from `.github/workflows/docs.yml`: the package docs at the root and this
dashboard at `/dashboard/`, with its data feed rebuilt from the master dataset (`data/processed/*.parquet`) at deploy time.
`data/web/` is therefore not committed.

`.github/workflows/monthly-update.yml` adds each new month. It runs daily from the 10th to the 25th, stops quietly
if the police have not posted last month yet, commits the updated master parquet to `main` and redeploys. If the month never arrives by the 25th the run fails, so GitHub emails the repository owner.
It can also be started by hand from the Actions tab.

## Credits

This site started from a crash-map dashboard by Reddit user **u/autosoap**, who gave permission
to reuse and adapt it. The layout and base stylesheet come from that project.

## Pages

`index.html` (map), `charts.html`, `hotspots.html` (hexagons and rankings) and `methodology.html`. Offense category, firearm and period are shared between pages through the page link. The list of masked (location-withheld) offense categories lives in `src/geocrime_stl/utils/web_export.py`.

## Ideas for later

- Flag missing times in the pipeline instead of filling midnight.
- A seasonal version of the day/night boundaries in the time-of-day chart.

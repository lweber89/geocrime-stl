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
| `radius.js` | The distance choices for an address or pin (¼ to 1 mile in quarters), shared by the map and Charts; tested in `tests/js/radius.test.js` |
| `data.js` | Loads the feed and gives every page the same clean records (`window.CRIME`) |
| `filters.js` | The one list of filter names (Where, When, What) and the one way to read and write them in the page link (`window.FILTERS`); Hotspots uses it for its links to the other pages, and the Where, When and What panels will build on it (#38); tested in `tests/js/filters.test.js` |
| `style.css` | Base layout and styles, adapted from the crash-map project (see Credits) |
| `crime.css` | Colours (offense-type palette) and the few crime-specific rules |
| `favicon.svg` | Site icon: a white shield with a star on royal blue. The docs site uses a copy at `docs/assets/favicon.svg`; if you change this file, copy it there too (the deploy checks they match) |

## Tests

`node --test tests/js/*.test.js` runs the unit tests and a **smoke test of the map page** (`tests/js/smoke.test.js`). The smoke test runs the real `radius.js`, `geocode.js`, `data.js` and `app.js` against a stand-in page, a stand-in Leaflet and a small fake feed, and walks through address search, the distance slider, pin drag, drop-a-pin and clear. It catches scripts that throw (for example after a variable is removed), which `node --check` cannot. It is not a real browser, so it cannot catch layout problems. If you change the page's element ids or how `app.js` builds the map, update the stand-ins in that file. GitHub runs the same command on every pull request (`.github/workflows/tests.yml`).

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
Crime-mapping practices we adopt are informed by the open work of Grant Drawve
([geographyofcrime.com](https://geographyofcrime.com)).

## Pages

`index.html` (map), `charts.html`, `hotspots.html` (hexagons and rankings) and `methodology.html`. Offense category, firearm and period are shared between pages through the page link. The list of masked (location-withheld) offense categories lives in `src/geocrime_stl/utils/web_export.py`.

## Ideas for later

- Flag missing times in the pipeline instead of filling midnight.
- A seasonal version of the day/night boundaries in the time-of-day chart.

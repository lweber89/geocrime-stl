# dashboard/

The public website: a static, client-side map and charts (plain HTML, CSS, JavaScript and Leaflet).
It contains **no data**. It reads the feed in `../data/web` (see `../data/README.md`).

## Run it locally

    python -m geocrime_stl.utils.web_export     # build data/web from the master dataset (if needed)
    python scripts/serve.py                     # then open http://localhost:8000

## Files

| File | Purpose |
|---|---|
| `index.html`, `app.js` | The crime map: filters, map, table |
| `data.js` | Loads the feed and gives every page the same clean records (`window.CRIME`) |
| `style.css` | Base layout and styles, adapted from the crash-map project (see Credits) |
| `crime.css` | Colours (offense-type palette) and the few crime-specific rules |
| `favicon.svg` | Site icon |

## Credits

This dashboard started from a crash-map dashboard by Reddit user **u/autosoap**, who gave permission
to reuse and adapt it. The layout and base stylesheet come from that project. Credit wording will be
updated once the author says how he would like to be credited.

## Not included yet

- `hotspots.html` and `charts.html`, which the page navigation links to, are still to be written.

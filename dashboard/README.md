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
| `crime.css` | Colours (offense-type palette) and the few crime-specific rules |
| `favicon.svg` | Site icon |

## Not included yet

- **`style.css`.** `index.html` loads it before `crime.css`, which only overrides parts of it. It is
  the base stylesheet from the original crash-map project this dashboard started from, so it is
  deliberately not committed here until that project's licence has been checked and credited.
  Until it is added the page will load, but without its base layout.
- `hotspots.html` and `charts.html`, which the page navigation links to, are still to be written.

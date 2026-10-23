# data/

Everything the pipeline generates lives here, in two folders. The folder is located from the
repo root (not the working directory), so scripts behave the same wherever they are launched.
Set `GEOCRIME_DATA_DIR` to put it somewhere else.

| Folder | What it holds | Written by |
|---|---|---|
| `processed/` | The **master dataset**: every month, cleaned, as GeoParquet (committed). A GeoJSON copy is also written for GIS users, but it is large and is not committed; set `GEOCRIME_WRITE_GEOJSON=0` to skip it. `monthly/` holds one parquet per pipeline run (not committed) | `run_pipeline.py`, `download_historical_data.py` |
| `web/` | The dashboard feed: `manifest.json` plus one `YYYY-MM.json` per month. Not committed: the deploy workflow rebuilds it from the master | `geocrime_stl.utils.web_export.build_web_feed` |

The monthly CSVs from SLMPD are downloaded, cleaned and merged into the master dataset; the raw files are not kept.

The master dataset in `processed/` is the single source of truth. The dashboard feed and any
other product are rebuilt from it, never the other way round.

Rebuild just the dashboard feed from the master dataset:

    python -m geocrime_stl.utils.web_export

`dashboard/` (the website) never contains data. `scripts/serve.py` serves `data/web` at `/data/`
for local testing, and the deploy step copies `data/web` next to the site.

`data/web/` also holds `wards.geojson`: the 14 ward outlines (2023 boundaries) with 2020 census population, used for ward maps and per-resident rates. Each offense carries a `ward` assigned from its coordinates, because neighborhoods are split across wards.

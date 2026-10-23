# data/

Everything the pipeline generates lives here, in three folders. The folder is located from the
repo root (not the working directory), so scripts behave the same wherever they are launched.
Set `GEOCRIME_DATA_DIR` to put it somewhere else.

| Folder | What it holds | Written by |
|---|---|---|
| `raw/` | Monthly CSVs as published by SLMPD (not committed) | extract step, if raw files are kept |
| `processed/` | The **master dataset**: every month, cleaned, as GeoParquet and GeoJSON. `monthly/` holds one parquet per pipeline run (not committed) | `run_pipeline.py`, `download_historical_data.py` |
| `web/` | The dashboard feed: `manifest.json` plus one `YYYY-MM.json` per month | `geocrime_stl.utils.web_export.build_web_feed` |

The master dataset in `processed/` is the single source of truth. The dashboard feed and any
other product are rebuilt from it, never the other way round.

Rebuild just the dashboard feed from the master dataset:

    python -m geocrime_stl.utils.web_export

`dashboard/` (the website) never contains data. `scripts/serve.py` serves `data/web` at `/data/`
for local testing, and the deploy step copies `data/web` next to the site.

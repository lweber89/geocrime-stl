# Usage

## One month, in a few lines

    import geocrime_stl as gc

    pkg = gc.run_pipeline(4, 2026)      # month, year
    gc.generate_monthly_metrics(pkg)    # prints a short summary
    gc.plot_monthly_maps(pkg)           # four maps: all crimes, then person, property, society

`run_pipeline` downloads that month's file from SLMPD, cleans it, and keeps only records that fall inside the City of St. Louis. It returns a `CrimeDataPackage` with three parts:

| Part | Meaning |
|---|---|
| `pkg.df` | The cleaned table, one row per offense |
| `pkg.month`, `pkg.year` | The month and year it covers |

If SLMPD has not published the month yet (or the download fails) you get an empty table and a warning, not an exception.

Months from **January 2024** onward are supported. January to April 2024 were published under one-off file names; the package knows their addresses (see `SPECIAL_URLS` in `config.py`).

## What the cleaned table contains

| Column | Meaning |
|---|---|
| `inc_#` | Incident number |
| `date_time` | When the offense occurred (see the note on missing times in the FAQ) |
| `nibrs_cat`, `nibrs_code` | NIBRS category and code |
| `offense`, `inc_desc` | Offense and incident description |
| `off_type` | Crime against Person, Property or Society |
| `firearm` | Whether a firearm was used |
| `address`, `nbhd`, `nbhd_num`, `district`, `ward` | Where it happened (ward is assigned from the coordinates) |
| `lat`, `lon` | Coordinates |

## Saving a month

    gc.export_to_csv(pkg, output_dir="out")
    gc.export_to_geojson(pkg, output_dir="out")
    gc.export_to_gpkg(pkg, output_dir="out")

Files are named like `stl_crime_data_04_2026.csv`. Each function returns `True` on success and `False` (with a logged error) otherwise. The output folder must already exist.

## Building the full history (from a clone)

    python download_historical_data.py    # January 2024 through last month, about a few minutes
    python run_pipeline.py                # add the previous calendar month to the master dataset

`run_pipeline.py` always takes the previous calendar month. For a specific month, call it from Python: `from run_pipeline import run_monthly_etl; run_monthly_etl(month=9, year=2026)`.

These write the master dataset to `data/processed/slmpd_crime_data.parquet` (GeoParquet) and a GeoJSON copy for GIS users. Rebuild only the dashboard's data feed from the master with:

    python -m geocrime_stl.utils.web_export

See `data/README.md` in the repository for the folders and what is committed.

## Notebooks

Two example notebooks are on the **Examples** menu: a step-by-step walkthrough of the pipeline, and a hotspot demo.

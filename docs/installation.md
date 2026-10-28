# Installation

## From PyPI

    pip install geocrime-stl

Requires **Python 3.11 or newer**. The dependencies (geopandas, pandas, matplotlib, pyarrow, requests) are installed for you. geopandas is the heaviest; if `pip` struggles with it on your system, installing it first with conda (`conda install geopandas`) is the usual fix.

Check it worked:

    python -c "import geocrime_stl; print('ok')"

## From a clone of the repository

Clone the repository if you want the scripts that build the full history, the Explorer code, or the committed master dataset. They are **not** part of the PyPI package.

    git clone https://github.com/lweber89/geocrime-stl.git
    cd geocrime-stl
    pip install -e .

## What you get either way

| | `pip install` | `git clone` |
|---|---|---|
| The `geocrime_stl` library (download, clean, export, summarize) | yes | yes |
| City, ward and neighborhood boundary files used by the library | yes | yes |
| `run_pipeline.py` (add one month) and `download_historical_data.py` (build the full history) | no | yes |
| The master dataset (`data/processed/slmpd_crime_data.parquet`) | no | yes |
| The Explorer source (`dashboard/`) | no | yes |

Generated data goes into a `data/` folder. In a clone it sits at the repository root. With a plain `pip install` it is created in the folder you run Python from. Set the environment variable `GEOCRIME_DATA_DIR` to put it somewhere else.

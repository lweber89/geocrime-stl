"""Helpers for the master dataset: every month of cleaned crime data in one GeoParquet file.

The master file is the single source of truth. The monthly pipeline merges each new month into it,
and everything downstream (GIS exports, the dashboard's web feed) is built from it.
"""

from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

from geocrime_stl.config import MASTER_GEOJSON, MASTER_PARQUET

logger = logging.getLogger(__name__)


def load_master(path: Path | str | None = None) -> pd.DataFrame:
    """Read the master dataset as a plain DataFrame (any geometry column is dropped).

    Returns an empty DataFrame if the file does not exist yet.
    """
    path = Path(path) if path else MASTER_PARQUET
    if not path.exists():
        return pd.DataFrame()
    df = pd.read_parquet(path)
    return df.drop(columns=["geometry"], errors="ignore")


def ensure_wards(df: pd.DataFrame) -> pd.DataFrame:
    """Add the ``ward`` column if it is missing or incomplete (older master files have none).

    Needs GeoPandas. Rows that already have a ward are re-assigned too; the result is the same
    because the ward comes from the coordinates and the boundary file.
    """
    if df.empty:
        return df
    has_coords = df["lat"].notna() & df["lon"].notna() if {"lat", "lon"} <= set(df.columns) else None
    if "ward" in df.columns and has_coords is not None and not (df["ward"].isna() & has_coords).any():
        return df
    from geocrime_stl.utils.wards import assign_wards  # noqa: PLC0415

    logger.info("Assigning wards to %d rows", len(df))
    return assign_wards(df)


def merge_month(master: pd.DataFrame, month_df: pd.DataFrame, month: int, year: int) -> pd.DataFrame:
    """Replace one month of the master dataset with freshly processed rows.

    Any existing rows for that month are removed first, so re-running a month (for example after
    SLMPD revises a file) never creates duplicates. Order within each month is preserved.

    Args:
        master: The existing master DataFrame (may be empty).
        month_df: The new month's cleaned rows, from ``run_pipeline(...).df``.
        month: The month being merged (1-12).
        year: The four-digit year being merged.
    """
    month_df = month_df.drop(columns=["geometry"], errors="ignore")
    if master.empty:
        return month_df.reset_index(drop=True)

    when = pd.to_datetime(master["date_time"], errors="coerce")
    in_month = (when.dt.year == year) & (when.dt.month == month)
    kept = master.loc[~in_month]
    logger.info("Replacing %d existing rows for %d-%02d with %d new rows", int(in_month.sum()), year, month, len(month_df))

    combined = pd.concat([kept, month_df], ignore_index=True)
    month_key = pd.to_datetime(combined["date_time"], errors="coerce").dt.to_period("M")
    # sort by month only, and stably, so the file order inside each month is kept
    combined = combined.assign(_month=month_key).sort_values("_month", kind="stable")
    return combined.drop(columns="_month").reset_index(drop=True)


def save_master(
    df: pd.DataFrame,
    parquet_path: Path | str | None = None,
    geojson_path: Path | str | None = None,
    *,
    write_geojson: bool | None = None,
) -> None:
    """Write the master dataset as GeoParquet and (optionally) GeoJSON.

    The GeoJSON is a convenience for GIS users (it is large and is not committed to git). Pass ``write_geojson``
    to choose, or set the environment variable ``GEOCRIME_WRITE_GEOJSON=0`` to skip it (the monthly GitHub Action does).

    GeoPandas is imported here, not at module level, so the rest of this module works without it.
    """
    import os  # noqa: PLC0415

    import geopandas as gpd  # noqa: PLC0415

    if write_geojson is None:
        write_geojson = os.environ.get("GEOCRIME_WRITE_GEOJSON", "1") != "0"

    parquet_path = Path(parquet_path) if parquet_path else MASTER_PARQUET
    geojson_path = Path(geojson_path) if geojson_path else MASTER_GEOJSON
    parquet_path.parent.mkdir(parents=True, exist_ok=True)

    df = df.drop(columns=["geometry"], errors="ignore")
    gdf = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df["lon"], df["lat"]), crs="EPSG:4326")

    gdf.to_parquet(parquet_path, compression="snappy", index=False)
    logger.info("Master GeoParquet written: %s (%d rows)", parquet_path, len(gdf))
    if write_geojson:
        gdf.to_file(geojson_path, driver="GeoJSON")
        logger.info("Master GeoJSON written: %s", geojson_path)

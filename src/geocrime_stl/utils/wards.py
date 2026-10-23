"""Assign each crime record to a City of St. Louis ward (the 14 wards in effect since 2023).

Neighborhoods and wards do not nest: most neighborhoods are split across two or more wards, so a
record's ward must come from its coordinates, not from its neighborhood.
"""

from __future__ import annotations

import logging

import pandas as pd

from geocrime_stl.config import WARDS_BNDY

logger = logging.getLogger(__name__)

__all__ = ["assign_wards", "NEAREST_MAX_M"]

# A handful of points sit a few metres outside every ward (slivers along the city edge). They are
# given the nearest ward if it is within this distance; farther away they stay unassigned.
NEAREST_MAX_M = 150


def assign_wards(df: pd.DataFrame, wards_path=None) -> pd.DataFrame:
    """Return ``df`` with a nullable-integer ``ward`` column (1-14), placed right after ``district``.

    Rows without coordinates, or farther than ``NEAREST_MAX_M`` from any ward, get ``<NA>``.
    An existing ``ward`` column is replaced. GeoPandas is imported here so the rest of the
    package works without it.
    """
    import geopandas as gpd  # noqa: PLC0415

    path = wards_path or WARDS_BNDY
    if not path.exists():
        raise FileNotFoundError(f"Ward boundary file not found: {path}")

    df = df.drop(columns=["ward"], errors="ignore").reset_index(drop=True)
    wards = gpd.read_file(path).to_crs("EPSG:4326")
    wards["ward"] = pd.to_numeric(wards["WARD"], errors="raise").astype("int64")
    wards = wards[["ward", "geometry"]]

    ok = df["lat"].notna() & df["lon"].notna()
    pts = gpd.GeoDataFrame(
        {"_i": df.index[ok]}, geometry=gpd.points_from_xy(df.loc[ok, "lon"], df.loc[ok, "lat"]), crs="EPSG:4326"
    )

    # "intersects" so a point exactly on a shared boundary still matches; keep one ward per point.
    hit = gpd.sjoin(pts, wards, how="left", predicate="intersects").drop_duplicates("_i")
    found = hit.set_index("_i")["ward"]

    lost = found[found.isna()].index
    if len(lost):
        proj = "EPSG:26915"  # UTM 15N (metres) covers St. Louis
        near = gpd.sjoin_nearest(
            pts[pts["_i"].isin(lost)].to_crs(proj), wards.to_crs(proj),
            how="left", max_distance=NEAREST_MAX_M, distance_col="_d",
        ).drop_duplicates("_i").set_index("_i")["ward"]
        found = found.where(found.notna(), near.reindex(found.index))
        logger.info("%d points outside every ward: %d given the nearest ward", len(lost), int(near.notna().sum()))

    ward = pd.Series(pd.NA, index=df.index, dtype="Int64")
    ward.loc[found.index] = found.astype("Int64")
    out = df.copy()
    pos = out.columns.get_loc("district") + 1 if "district" in out.columns else len(out.columns)
    out.insert(pos, "ward", ward)
    n_na = int(out["ward"].isna().sum())
    if n_na:
        logger.warning("%d rows have no ward (no coordinates or outside the city)", n_na)
    return out

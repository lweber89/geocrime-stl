"""Build the dashboard's data feed: one compact JSON file per month plus a manifest.

The dashboard (see ``dashboard/``) is a static site, so it cannot query a database. Instead the
pipeline publishes small files it can download once and cache:

    data/web/manifest.json     which months exist, row counts, "data through" date, cache-buster
    data/web/YYYY-MM.json      every offense for one month, with repeated strings stored once

The feed is rebuilt in full from the master dataset every time (about a second), so late revisions
to earlier months are always picked up. The build is all-or-nothing: it is validated first and
written to a temporary folder, so a bad run can never leave a half-written or truncated feed behind.

File format, one row per offense::

    {"m": "2026-09",
     "d": {"type": [...], "cat": [...], "off": [...], "nbhd": [...], "ward": ["1", ..., "14"]},
     "r": [[inc, "YYYY-MM-DDTHH:MM", lat, lon, address,
            typeIdx, catIdx, offenseIdx, nbhdIdx, district, firearm(0/1), estTime(0/1),
            wardIdx (-1 = no ward)], ...]}

It also writes ``wards.geojson`` (the 14 ward outlines with their 2020 census population) for maps.

Run from the command line to rebuild from the master dataset::

    python -m geocrime_stl.utils.web_export [--out DIR] [--source FILE] [--force]
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import shutil
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from geocrime_stl.config import STL_MAP_CONFIG, WARDS_BNDY, WEB_DIR
from geocrime_stl.utils.dataset import ensure_wards, load_master

logger = logging.getLogger(__name__)

__all__ = ["WebExportError", "build_web_feed"]

SCHEMA_VERSION = 2

# Columns the feed needs. nibrs_code, inc_desc and nbhd_num are not used by the dashboard.
REQUIRED_COLUMNS = (
    "inc_#", "date_time", "nibrs_cat", "offense", "off_type",
    "firearm", "address", "nbhd", "district", "lat", "lon",
)
KNOWN_TYPES = ("Person", "Property", "Society", "Other")

# District 0 is a handful of rows SLMPD could not assign to a district; their addresses are
# malformed (a zip code, an interstate), so their coordinates cannot be trusted. They stay in the
# counts and tables but are exported without coordinates.
UNASSIGNED_DISTRICTS = frozenset({"0"})

# Times that are probably "unknown" placeholders rather than real clock times. The ETL fills a
# missing OccurredFromTime with 00:00, and the source data has a second spike at exactly 12:00.
# These rows are flagged (est=1) so hour-of-day views can leave them out.
PLACEHOLDER_TIMES = frozenset({"00:00", "12:00"})

BOUNDS_MARGIN_DEG = 0.02   # slack around the city's bounding box before a point counts as unmapped
SNAP_MAX_M = 30            # geocoding jitter: snap an address to its most common point within this
MAX_ROW_DROP = 0.05        # refuse a feed that has >5% fewer rows than the one it would replace
MIN_LATEST_RATIO = 0.5     # refuse if the newest month has <50% of the typical recent month

_M_PER_DEG_LAT = 110540
_M_PER_DEG_LON = 111320 * math.cos(math.radians(38.63))


class WebExportError(RuntimeError):
    """The feed could not be built safely. Nothing on disk was changed."""


# ---------------------------------------------------------------- preparation
def _text(series: pd.Series, default: str = "") -> pd.Series:
    """Series of plain strings, with missing and blank values replaced by ``default``."""
    s = series.astype("object").where(series.notna(), default).astype(str).str.strip()
    return s.where(s != "", default)


def _snap_to_address_mode(addr: pd.Series, lat: pd.Series, lon: pd.Series, max_m: float = SNAP_MAX_M):
    """Snap rows to the most common point of their address, if it is within ``max_m`` metres.

    One address often geocodes to several points ~10 m apart. Without this, one store draws as two
    overlapping circles with split counts. The distance limit protects labels that legitimately
    cover many places (for example "I-44 W").
    """
    ok = lat.notna() & lon.notna() & (addr != "")
    if not ok.any():
        return lat, lon, 0
    counts = (
        pd.DataFrame({"a": addr[ok], "lat": lat[ok], "lon": lon[ok]})
        .groupby(["a", "lat", "lon"]).size().rename("n").reset_index()
    )
    modal = (
        counts.sort_values(["n", "lat", "lon"], ascending=[False, True, True], kind="stable")
        .drop_duplicates("a").set_index("a")
    )
    mlat, mlon = addr.map(modal["lat"]), addr.map(modal["lon"])
    dist = (((lat - mlat) * _M_PER_DEG_LAT) ** 2 + ((lon - mlon) * _M_PER_DEG_LON) ** 2) ** 0.5
    near = ok & mlat.notna() & (dist <= max_m)
    moved = int((near & ((lat != mlat) | (lon != mlon))).sum())
    return lat.where(~near, mlat), lon.where(~near, mlon), moved


def _prepare(df: pd.DataFrame) -> pd.DataFrame:
    """Validate the input and return clean, typed columns ready to be written."""
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise WebExportError(f"Input is missing required columns: {missing}")
    if df.empty:
        raise WebExportError("Input has no rows.")

    when = pd.to_datetime(df["date_time"], errors="coerce")
    bad_time = int(when.isna().sum())
    if bad_time > max(10, 0.01 * len(df)):
        raise WebExportError(f"{bad_time:,} of {len(df):,} rows have an unreadable date_time.")
    if bad_time:
        logger.warning("Dropping %d rows with an unreadable date_time", bad_time)

    d = pd.DataFrame({
        "inc": _text(df["inc_#"]),
        "t": when,
        "lat": pd.to_numeric(df["lat"], errors="coerce"),
        "lon": pd.to_numeric(df["lon"], errors="coerce"),
        "addr": _text(df["address"]),
        "type": _text(df["off_type"], "Other"),
        "cat": _text(df["nibrs_cat"], "Unknown"),
        "off": _text(df["offense"], "Unknown"),
        "nbhd": _text(df["nbhd"], "Unknown"),
        "district": _text(df["district"]),
        "firearm": _text(df["firearm"]).str.lower().isin(["yes", "y", "true", "1"]).astype(int),
        # ward comes from the coordinates; older master files may not have it yet (-> no ward)
        "ward": pd.to_numeric(df["ward"], errors="coerce") if "ward" in df.columns else float("nan"),
    })
    d = d[d["t"].notna()].copy()

    unknown_types = sorted(set(d["type"]) - set(KNOWN_TYPES))
    if unknown_types:
        logger.warning("Unexpected off_type values %s were exported as 'Other'", unknown_types)
        d.loc[~d["type"].isin(KNOWN_TYPES), "type"] = "Other"

    # Coordinates that are missing, outside the city (plus a margin), or untrustworthy -> unmapped.
    ymin, xmin, ymax, xmax = STL_MAP_CONFIG.bbox
    m = BOUNDS_MARGIN_DEG
    outside = ~(d["lat"].between(ymin - m, ymax + m) & d["lon"].between(xmin - m, xmax + m))
    unassigned = d["district"].isin(UNASSIGNED_DISTRICTS)
    if unassigned.any():
        logger.info("%d rows in unassigned district(s) exported without coordinates", int(unassigned.sum()))
        d.loc[unassigned, "nbhd"] = "Unknown"
    d.loc[outside | unassigned, ["lat", "lon", "ward"]] = float("nan")

    d["lat"], d["lon"], moved = _snap_to_address_mode(d["addr"], d["lat"], d["lon"])
    logger.info("%d rows snapped to their address's most common point", moved)

    d["est"] = d["t"].dt.strftime("%H:%M").isin(PLACEHOLDER_TIMES).astype(int)
    d["month"] = d["t"].dt.strftime("%Y-%m")
    # Stable order => stable row ids (the dashboard identifies a row as "<month>-<position>").
    return d.sort_values(["t", "inc"], kind="stable").reset_index(drop=True)


# ---------------------------------------------------------------- validation
def _read_manifest(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _validate(counts: dict[str, int], previous: dict | None, *, force: bool) -> None:
    """Raise WebExportError if the new feed looks wrong. Runs before anything is written."""
    months = sorted(counts)
    expected = [str(p) for p in pd.period_range(months[0], months[-1], freq="M")]
    gaps = [m for m in expected if m not in counts]
    if gaps:
        raise WebExportError(f"Months missing between {months[0]} and {months[-1]}: {gaps}")

    if force:
        return
    if len(months) >= 4:
        typical = statistics.median(counts[m] for m in months[-4:-1])
        if typical and counts[months[-1]] < MIN_LATEST_RATIO * typical:
            raise WebExportError(
                f"Newest month {months[-1]} has {counts[months[-1]]:,} rows, under "
                f"{MIN_LATEST_RATIO:.0%} of the recent typical {typical:,.0f}. "
                "It may be partial. Re-run with force=True (--force) if that is expected."
            )
    prev_rows = (previous or {}).get("rows")
    if prev_rows:
        new_rows = sum(counts.values())
        if new_rows < (1 - MAX_ROW_DROP) * prev_rows:
            raise WebExportError(
                f"New feed has {new_rows:,} rows, down from {prev_rows:,} "
                f"(more than {MAX_ROW_DROP:.0%} fewer). Re-run with force=True (--force) if intended."
            )


# ---------------------------------------------------------------- writing
def _encode(series: pd.Series) -> tuple[list[str], list[int]]:
    values = sorted(series.unique())
    index = {v: i for i, v in enumerate(values)}
    return values, series.map(index).tolist()


def _month_file(month: str, g: pd.DataFrame, wards: list[str]) -> dict:
    dicts, codes = {}, {}
    for key in ("type", "cat", "off", "nbhd"):
        dicts[key], codes[key] = _encode(g[key])
    dicts["ward"] = wards                       # the same list in every file, in numeric order
    widx = {w: i for i, w in enumerate(wards)}
    ward_codes = [widx.get(str(int(w)), -1) if pd.notna(w) else -1 for w in g["ward"]]
    lat = [None if pd.isna(x) else round(float(x), 5) for x in g["lat"]]
    lon = [None if pd.isna(x) else round(float(x), 5) for x in g["lon"]]
    rows = [
        [inc, t.strftime("%Y-%m-%dT%H:%M"), la, lo, ad, ty, ca, of, nb, di, fa, es, wd]
        for inc, t, la, lo, ad, ty, ca, of, nb, di, fa, es, wd in zip(
            g["inc"], g["t"], lat, lon, g["addr"],
            codes["type"], codes["cat"], codes["off"], codes["nbhd"],
            g["district"], g["firearm"], g["est"], ward_codes,
        )
    ]
    return {"m": month, "d": dicts, "r": rows}


def _write_wards(path: Path) -> list[str]:
    """Write a slim copy of the ward outlines (number + population) and return the ward numbers."""
    src = json.loads(WARDS_BNDY.read_text(encoding="utf-8"))

    def rnd(c):
        return [round(c[0], 5), round(c[1], 5)] if isinstance(c[0], (int, float)) else [rnd(x) for x in c]

    feats = [
        {"type": "Feature",
         "properties": {"ward": int(f["properties"]["WARD"]), "pop": int(f["properties"].get("TOT_POP") or 0)},
         "geometry": {"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"])}}
        for f in sorted(src["features"], key=lambda f: int(f["properties"]["WARD"]))
    ]
    path.write_text(json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")), encoding="utf-8")
    return [str(f["properties"]["ward"]) for f in feats]


def build_web_feed(
    df: pd.DataFrame | None = None,
    out_dir: Path | str | None = None,
    *,
    force: bool = False,
) -> dict:
    """Rebuild the dashboard feed from the master dataset.

    Args:
        df: Cleaned crime rows for ALL months. If omitted, the master dataset is loaded from disk.
        out_dir: Destination folder. Defaults to ``config.WEB_DIR`` (``data/web``).
        force: Skip the plausibility checks (partial newest month, big drop in total rows).

    Returns:
        The manifest that was written.

    Raises:
        WebExportError: If the input is unusable or the result fails validation. The existing
            feed is left untouched in that case.
    """
    out_dir = Path(out_dir) if out_dir else WEB_DIR
    if df is None:
        df = load_master()
        if df.empty:
            raise WebExportError("Master dataset not found or empty. Run download_historical_data.py first.")
        try:
            df = ensure_wards(df)
        except Exception as err:  # e.g. GeoPandas not installed: build the feed without wards
            logger.warning("Wards could not be assigned (%s); the feed will have no ward data", err)

    d = _prepare(df)
    counts = d.groupby("month").size().to_dict()
    _validate(counts, _read_manifest(out_dir / "manifest.json"), force=force)

    # Write everything to a sibling temp folder, then swap it into place.
    tmp = out_dir.with_name(out_dir.name + ".tmp")
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    try:
        wards = _write_wards(tmp / "wards.geojson")
        for month, g in d.groupby("month", sort=True):
            with open(tmp / f"{month}.json", "w", encoding="utf-8") as f:
                json.dump(_month_file(month, g, wards), f, separators=(",", ":"))
        months = sorted(counts)
        manifest = {
            "schema": SCHEMA_VERSION,
            "built": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"),  # cache-buster for the browser
            "through": d["t"].max().strftime("%Y-%m-%d"),
            # SLMPD posts each month whole, so the newest month counts as complete.
            "completeThrough": months[-1],
            "rows": int(len(d)),
            "incidents": int(d["inc"].nunique()),
            "unmapped": int(d["lat"].isna().sum()),
            "noWard": int(d["ward"].isna().sum()),
            "months": [{"m": m, "n": int(counts[m])} for m in months],
        }
        (tmp / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
        if out_dir.exists():
            shutil.rmtree(out_dir)
        out_dir.parent.mkdir(parents=True, exist_ok=True)
        tmp.rename(out_dir)
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise

    logger.info("Web feed written: %d months, %d rows, through %s -> %s",
                len(months), manifest["rows"], manifest["through"], out_dir)
    return manifest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Rebuild the dashboard data feed from the master dataset.")
    parser.add_argument("--source", help="Master parquet file (default: data/processed/slmpd_crime_data.parquet)")
    parser.add_argument("--out", help="Output folder (default: data/web)")
    parser.add_argument("--force", action="store_true", help="Skip the plausibility checks")
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
    try:
        df = load_master(args.source) if args.source else None
        manifest = build_web_feed(df, args.out, force=args.force)
    except WebExportError as err:
        logger.error("%s", err)
        return 1
    print(f"Wrote {len(manifest['months'])} month files, {manifest['rows']:,} rows, through {manifest['through']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

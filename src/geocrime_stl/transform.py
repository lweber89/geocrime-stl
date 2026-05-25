from __future__ import annotations

import logging
from dataclasses import dataclass

import geopandas as gpd
import pandas as pd

from geocrime_stl.config import COLUMN_RENAMES, COLUMNS_TO_DROP, FINAL_SCHEMA_COLUMNS

from .config import CITY_BNDY_WGS84

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CrimeDataPackage:
    """Wrapper that bundles structured monthly crime data with its target temporal metadata."""

    df: pd.DataFrame
    month: int
    year: int


def raw_csv_to_dataframe(csv_bytes: bytes, **kwargs) -> pd.DataFrame:
    """Converts raw byte stream cleanly into an in-memory Pandas DataFrame.

    Accepts optional kwargs to pass directly to pd.read_csv if needed down the road.
    """
    import io

    try:
        return pd.read_csv(io.BytesIO(csv_bytes), **kwargs)
    except Exception as e:
        raise ValueError(f"Failed to decode raw byte stream to DataFrame: {e}") from e


def clean_and_spatial_clip(
    df: pd.DataFrame, month: int, year: int
) -> CrimeDataPackage:
    """Normalizes features, handles type enforcement, and spatially clips observations

    to St. Louis City limits. Returns a populated CrimeDataPackage wrapper.
    """
    # Handle the original empty CSV dataset scenario gracefully
    if df.empty:
        logger.warning(
            f"⚠️ Ingested DataFrame was empty. Skipping cleaning pipelines for {month}/{year}."
        )
        return CrimeDataPackage(df=df, month=month, year=year)

    # 1. Date Alignments & Conversions
    df["IncidentDate"] = pd.to_datetime(
        df["IncidentDate"], format="%m/%d/%Y", exact=False, errors="coerce"
    )

    # Filter by date alignment (keeps only requested month/year observations)
    df = df[(df["IncidentDate"].dt.month == month) & (df["IncidentDate"].dt.year == year)].copy()

    # 2. String Timestamp Synthesis
    df["OccurredFromTime"] = df["OccurredFromTime"].fillna("00:00")
    combined_time_str = (
        df["IncidentDate"].dt.strftime("%Y-%m-%d") + " " + df["OccurredFromTime"].astype(str)
    )
    df["date_time"] = pd.to_datetime(combined_time_str, errors="coerce")

    # 3. Structural Re-mapping & Column Dropping
    df = df.rename(columns=COLUMN_RENAMES)
    df = df.drop(columns=COLUMNS_TO_DROP, errors="ignore")

    # 4. Data Type Enforcement
    df["district"] = pd.to_numeric(df["district"], errors="coerce")
    df["district"] = df["district"].astype("Int64").astype("string")
    df["inc_#"] = df["inc_#"].astype("string")

    # 5. Regex Character Stripping (e.g., "G-88" -> 88)
    df["nbhd_num"] = df["nbhd_num"].astype(str).str.extract(r"(\d+)", expand=False)
    df["nbhd_num"] = pd.to_numeric(df["nbhd_num"], errors="coerce").astype("Int64")
    df["off_type"] = df["off_type"].replace("Unspecified", "Other")

    # 6. Coordinate Sanitization
    df["lon"] = pd.to_numeric(df["lon"], errors="coerce")
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df = df.dropna(subset=["lon", "lat"]).copy()

    # 7. Apply Final Schema Alignment from global configuration
    existing_cols = [col for col in FINAL_SCHEMA_COLUMNS if col in df.columns]
    df = df[existing_cols]

    # 8. Spatial Boundary Clipping Execution
    try:
        clipped_df = clip_df(df)
        return CrimeDataPackage(df=clipped_df, month=month, year=year)
    except Exception as e:
        logger.warning(f"⚠️ Spatial fencing bypassed due to pipeline engine block: {e}")
        logger.info("▶️ Flowing original full metropolitan boundary coordinates forward.")
        return CrimeDataPackage(df=df, month=month, year=year)


def clip_df(df: pd.DataFrame) -> pd.DataFrame:
    """Restricts point coordinates to the formal polygon limits of St. Louis City

    using an inner spatial join.
    """
    if not CITY_BNDY_WGS84.exists():
        raise FileNotFoundError(
            f"Could not locate boundary file asset at designated config path: {CITY_BNDY_WGS84}"
        )

    # Temporarily switch structure to an explicit GeoDataFrame ('gdf')
    gdf = gpd.GeoDataFrame(
        df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326"
    )

    # Ingest the boundary file directly using your pathlib setup
    stl_boundary = gpd.read_file(CITY_BNDY_WGS84).to_crs("EPSG:4326")

    # Inner join drops any points falling outside the boundary polygon limits
    gdf = gpd.sjoin(gdf, stl_boundary[["geometry"]], how="inner", predicate="within").copy()

    if "index_right" in gdf.columns:
        gdf = gdf.drop(columns=["index_right"])

    # Revert back to standard DataFrame structure and throw away spatial metadata
    return pd.DataFrame(gdf.drop(columns=["geometry"])).copy()

def run_pipeline(month: int, year: int) -> CrimeDataPackage:
    """Runs the entire ingestion, cleaning, and spatial-clipping pipeline 

    for a given month and year. Safely catches missing assets gracefully.
    """
    from geocrime_stl import extract
    
    # 1. Build the target URL
    url, m_int, y_int = extract.construct_url(month_input=month, year_input=year)
    
    # 2. Fetch the stream from SLMPD with built-in safety net
    try:
        raw_bytes = extract.fetch_crime_data_csv(url, keep_raw_csv=False)
    except extract.ExtractionError as e:
        # Catch 404s or network drops gracefully
        logger.warning(
            f"🛑 Unable to retrieve data for {month}/{year}. "
            f"The asset might not be published yet. Details: {e}"
        )
        # Return an empty dataframe package so the user's notebook doesn't crash
        import pandas as pd
        return CrimeDataPackage(df=pd.DataFrame(), month=m_int, year=y_int)
    
    # 3. Decode bytes to DataFrame (Only runs if extraction succeeded!)
    raw_df = raw_csv_to_dataframe(raw_bytes)
    
    # 4. Clean, type-enforce, and clip to city boundaries
    data_package = clean_and_spatial_clip(raw_df, m_int, y_int)
    
    return data_package
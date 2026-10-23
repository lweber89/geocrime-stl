"""Global configuration settings, file paths, and schema definitions for the GeoCrime STL package."""

import os
from pathlib import Path
from typing import NamedTuple

# --- Paths ---
# Two different kinds of "data" live in this project, and they are kept apart on purpose:
#
#   RESOURCES_DIR  boundary files that SHIP INSIDE the package (src/geocrime_stl/data).
#   DATA_DIR       data the pipeline GENERATES (<repo>/data): raw CSVs, GIS products, web feed.
PACKAGE_DIR = Path(__file__).resolve().parent
BASE_DIR = PACKAGE_DIR  # kept so existing imports of BASE_DIR keep working
RESOURCES_DIR = PACKAGE_DIR / "data"


def _resolve_data_dir() -> Path:
    """Locate the folder for generated data.

    Order: the GEOCRIME_DATA_DIR environment variable; else <repo root>/data when running from a
    source checkout (so it does not matter which folder a script is launched from); else ./data
    under the current working directory (e.g. when installed from PyPI).
    """
    override = os.environ.get("GEOCRIME_DATA_DIR")
    if override:
        return Path(override).expanduser().resolve()
    repo_root = PACKAGE_DIR.parents[1]  # src/geocrime_stl -> src -> repo root
    if (repo_root / "pyproject.toml").is_file() and (repo_root / "src").is_dir():
        return repo_root / "data"
    return Path.cwd() / "data"


DATA_DIR = _resolve_data_dir()
PROCESSED_DIR = DATA_DIR / "processed"  # master dataset and GIS products (parquet, geojson, gpkg)
WEB_DIR = DATA_DIR / "web"              # manifest.json + YYYY-MM.json feed for the dashboard

MASTER_PARQUET = PROCESSED_DIR / "slmpd_crime_data.parquet"
MASTER_GEOJSON = PROCESSED_DIR / "slmpd_crime_data.geojson"

CITY_BNDY = RESOURCES_DIR / "stl_boundary.geojson"
NBHD_BNDY = RESOURCES_DIR / "stl_neighborhoods.geojson"  # neighborhood_id, neighborhood_name, total_population (2020 census)
CITY_BNDY_WGS84 = RESOURCES_DIR / "stl_boundary_wgs84.geojson"
WARDS_BNDY = RESOURCES_DIR / "stl_wards.geojson"  # 14 wards in effect since 2023; WARD number + TOT_POP (2020 census)


# --- Map Configuration ---
class MapConfig(NamedTuple):
    """Configuration container for map rendering defaults.

    Attributes:
        coords: Center coordinates (latitude, longitude) for the map view.
        zoom: Initial zoom level.
        height: CSS height string for map containers.
        bbox: Bounding box coordinates (ymin, xmin, ymax, xmax).
    """

    coords: tuple[float, float]
    zoom: float
    height: str
    bbox: tuple[float, float, float, float]


STL_MAP_CONFIG = MapConfig(
    coords=(38.65428167189044, -90.25320053100587),
    zoom=11.5,
    height="925px",
    bbox=(38.5318, -90.3205, 38.7744, -90.1663),
)


# --- SLMPD ETL Settings ---
BASE_URL = "https://slmpd.org/wp-content/uploads"

COLUMN_RENAMES = {
    "Latitude": "lat",
    "Longitude": "lon",
    "IncidentNum": "inc_#",
    "NIBRS": "nibrs_code",
    "NIBRSCategory": "nibrs_cat",
    "CrimeAgainst": "off_type",
    "IncidentLocation": "address",
    "District": "district",
    "Neighborhood": "nbhd",
    "NbhdNum": "nbhd_num",
    "FirearmUsed": "firearm",
    "IncidentNature": "inc_desc",
    "Offense": "offense",
}

COLUMNS_TO_DROP = (
    "IncidentDate",
    "OccurredFromTime",
    "SRS_UCR",
    "IncidentTopSRS_UCR",
    "IntersectionOtherLoc",
    "IncidentSupplemented",
    "LastSuppDate",
    "VictimNum",
    "FelMisdCit",
)

FINAL_SCHEMA_COLUMNS = [
    "inc_#",
    "date_time",
    "nibrs_cat",
    "nibrs_code",
    "offense",
    "inc_desc",
    "off_type",
    "firearm",
    "address",
    "nbhd",
    "nbhd_num",
    "district",
    "ward",
    "lat",
    "lon",
]
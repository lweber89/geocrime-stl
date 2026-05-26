from pathlib import Path
from typing import NamedTuple

# --- Paths ---
# .parent takes us to 'geocrime_stl', the second .parent takes us out to 'src'
# The third .parent takes us to the root project directory where 'data' lives!
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"

CITY_BNDY = DATA_DIR / "stl_boundary.geojson"
NBHD_BNDY = DATA_DIR / "stl_neighborhoods.geojson"
CITY_BNDY_WGS84 = DATA_DIR / "stl_boundary_wgs84.geojson"


# --- Map Configuration ---
class MapConfig(NamedTuple):
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
    "lat",
    "lon",
]
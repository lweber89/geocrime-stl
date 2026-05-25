"""
Geospatial constants for the St. Louis metropolitan area.
"""



# Center coordinates
_coords = [38.65428167189044, -90.25320053100587]

# Default zoom level
_zoom = 11.5

# Default height for STL Maps

_height = "925px"

# Bounding box covering St. Louis City limits
_bbox = [38.5318, -90.3205, 38.7744, -90.1663]

# The master configuration tuple (Center, Zoom, Bounding Box)
STL_MAP_CONFIG = (_coords, _zoom, _height, _bbox)

BASE_URL = "https://slmpd.org/wp-content/uploads"

# Schema Remapping Dictionary
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

# Unneeded Columns List
COLUMNS_TO_DROP = [
    "IncidentDate",
    "OccurredFromTime",
    "SRS_UCR",
    "IncidentTopSRS_UCR",
    "IntersectionOtherLoc",
    "IncidentSupplemented",
    "LastSuppDate",
    "VictimNum",
    "FelMisdCit",
]
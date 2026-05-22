"""
Geospatial constants for the St. Louis metropolitan area.
"""

# 1. Center coordinates (Cortex / Central West End)
_coords = [38.65428167189044, -90.25320053100587]

# 2. Default zoom level
_zoom = 11.5

# Default height for STL Maps

_height = "925px"

# 3. Bounding box covering St. Louis City limits
_bbox = [38.5318, -90.3205, 38.7744, -90.1663]

# The master configuration tuple (Center, Zoom, Bounding Box)
STL_MAP_CONFIG = (_coords, _zoom, _height, _bbox)
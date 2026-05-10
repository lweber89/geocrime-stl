import os
import sys

print("--- 🔍 GEOCRIME-STL DIAGNOSTIC 🔍 ---")

# 1. Check Python Environment
print(f"Python Version: {sys.version.split()[0]}")
print(f"Executable: {sys.executable}")

# 2. Check for the Library
try:
    import geocrime_stl.data_cleaner as dc
    print(f"✅ Library: Found at {os.path.dirname(dc.__file__)}")
except ImportError:
    print("❌ Library: NOT FOUND. Did you run 'pip install -e .'?")

# 3. Check for Data Folder
if os.path.exists('data'):
    print("✅ Data Folder: Found.")
    # Check for the specific file
    if os.path.exists('data/stl_boundary.geojson'):
        print("✅ GeoJSON: Found 'data/stl_boundary.geojson'.")
    else:
        print("❌ GeoJSON: 'stl_boundary.geojson' is missing from the data folder.")
else:
    print("❌ Data Folder: 'data/' folder is missing.")

# 4. Check for Dependencies
try:
    import pandas as pd
    import geopandas as gpd
    print("✅ Dependencies: pandas and geopandas are installed.")
except ImportError as e:
    print(f"❌ Dependencies: Missing {e.name}")

print("-------------------------------------")
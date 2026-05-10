import geocrime_stl.data_cleaner as dc

# 1. Setup paths
url = "https://slmpd.org/wp-content/uploads/2026/05/April2026.csv"
boundary_path = "data/stl_boundary.geojson"

print("Step 1: Fetching data from SLMPD...")
raw_df = dc.fetch_stl_crime_data(url)

print(f"Step 2: Cleaning records for April 2026...")
# This uses the cleaning logic we moved into your library
clean_df = dc.clean_crime_dataframe(raw_df)

print("Step 3: Converting to GeoDataFrame and clipping to STL boundary...")
# This ensures the GeoJSON is being read correctly
gdf = dc.create_geodataframe(clean_df, boundary_path=boundary_path)

print("\n--- TEST RESULTS ---")
print(f"Total rows downloaded: {len(raw_df)}")
print(f"Rows after date/coord cleaning: {len(clean_df)}")
print(f"Rows remaining after spatial clip: {len(gdf)}")

if not gdf.empty:
    print("✅ SUCCESS: The pipeline is fully operational.")
else:
    print("⚠️ WARNING: Pipeline ran, but resulted in 0 records. Check coordinates!")
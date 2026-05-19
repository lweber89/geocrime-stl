import os
import geopandas as gpd
import pandas as pd

def export_data(df, output_name, output_dir="output"):
    """
    Takes the cleaned pandas DataFrame, converts it to a GeoDataFrame,
    and exports it to CSV, GeoJSON, Shapefile, or GeoPackage.
    """
    # Ensure the output directory exists
    os.makedirs(output_dir, exist_ok=True)
    base_path = os.path.join(output_dir, output_name)

    # 1. Export standard tabular CSV first (no spatial geometries needed)
    df.to_csv(f"{base_path}.csv", index=False)
    print(f"📁 Exported Tabular: {base_path}.csv")

    # 2. Convert to GeoDataFrame for spatial formats
    gdf = gpd.GeoDataFrame(
        df, 
        geometry=gpd.points_from_xy(df.lon, df.lat),
        crs="EPSG:4326"
    )

    # 3. Export Spatial Formats
    gdf.to_file(f"{base_path}.geojson", driver="GeoJSON")
    print(f"🌍 Exported Spatial: {base_path}.geojson")

    gdf.to_file(f"{base_path}.gpkg", driver="GPKG", layer="crime_incidents")
    print(f"📦 Exported Spatial: {base_path}.gpkg")

    # ESRI Shapefiles truncate column names to 10 chars, but it's great for desktop GIS
    gdf.to_file(f"{base_path}_shp", driver="ESRI Shapefile")
    print(f"🗺️ Exported Spatial: {base_path}_shp/ (Shapefile Directory)")
import logging
import os

import geopandas as gpd
import pandas as pd

# 1. Import the single source of truth from your core pipeline module
# (Adjust the path 'geocrime_stl.pipeline' to match whatever file holds your run_pipeline function)
from geocrime_stl.etl.transform import CrimeDataPackage

logger = logging.getLogger(__name__)


def _build_spatial_gdf(df: pd.DataFrame) -> gpd.GeoDataFrame:
    """
    Helper to reconstruct the GeoDataFrame geometry from spatial columns.
    Since the pipeline intentionally drops geometry columns before packaging, 
    this provides a consistent, isolated baseline for GIS-ready exports.
    """
    if "lon" in df.columns and "lat" in df.columns:
        return gpd.GeoDataFrame(
            df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326"
        )
    
    raise ValueError("The provided DataFrame lacks required 'lon' or 'lat' columns for spatial conversion.")


def export_to_csv(data_package: CrimeDataPackage, output_dir: str = ".") -> bool:
    """Exports the structured dataframe to a standard CSV file."""
    df = data_package.df
    month = data_package.month
    year = data_package.year
    
    filename = f"stl_crime_data_{month:02d}_{year}.csv"
    full_path = os.path.join(output_dir, filename)
    
    try:
        # If geometry somehow sneaked back into the dataframe, drop it safely
        df_to_export = df.drop(columns=['geometry'], errors='ignore')
        df_to_export.to_csv(full_path, index=False)
        logger.info(f"CSV successfully written to {full_path}")
        return True
    except PermissionError:
        logger.error(f"Cannot write CSV. Is {full_path} open in Excel?")
        return False
    except Exception as e:
        logger.error(f"Error exporting CSV to {full_path}: {e}")
        return False


def export_to_geojson(data_package: CrimeDataPackage, output_dir: str = ".") -> bool:
    """Reconstructs spatial points and exports to a standardized GeoJSON file."""
    df = data_package.df
    month = data_package.month
    year = data_package.year

    filename = f"stl_crime_data_{month:02d}_{year}.geojson"
    full_path = os.path.join(output_dir, filename)
    
    try:
        gdf = _build_spatial_gdf(df)
        gdf.to_file(full_path, driver="GeoJSON")
        logger.info(f"GeoJSON successfully written to {full_path}")
        return True
    except Exception as e:
        logger.error(f"Error exporting GeoJSON to {full_path}: {e}")
        return False


def export_to_gpkg(data_package: CrimeDataPackage, output_dir: str = ".") -> bool:
    """Reconstructs spatial points and exports to a standardized GeoPackage layer."""
    df = data_package.df
    month = data_package.month
    year = data_package.year

    filename = f"stl_crime_data_{month:02d}_{year}.gpkg"
    full_path = os.path.join(output_dir, filename)
    layer_name = f"stl_crime_{month:02d}_{year}"
    
    try:
        gdf = _build_spatial_gdf(df)
        gdf.to_file(full_path, driver="GPKG", layer=layer_name)
        logger.info(f"GeoPackage successfully written to {full_path} (Layer: {layer_name})")
        return True
    except PermissionError:
        logger.error(f"Cannot write GPKG. Is {full_path} locked by GIS software?")
        return False
    except Exception as e:
        logger.error(f"Error exporting GeoPackage to {full_path}: {e}")
        return False
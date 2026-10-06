"""Module for exporting structured crime data packages into various file formats (CSV, GeoJSON, GPKG)."""

from __future__ import annotations

import logging
import os

import geopandas as gpd
import pandas as pd

from geocrime_stl.etl.transform import CrimeDataPackage

logger = logging.getLogger(__name__)


def _build_spatial_gdf(df: pd.DataFrame) -> gpd.GeoDataFrame:
    """Reconstructs the GeoDataFrame geometry from spatial columns.

    Since the pipeline intentionally drops geometry columns before packaging, 
    this provides a consistent, isolated baseline for GIS-ready exports.

    Args:
        df: The pandas DataFrame containing 'lon' and 'lat' coordinate columns.

    Returns:
        gpd.GeoDataFrame: A GeoDataFrame with WGS84 point geometries.

    Raises:
        ValueError: If the DataFrame lacks required 'lon' or 'lat' columns.
    """
    if "lon" in df.columns and "lat" in df.columns:
        return gpd.GeoDataFrame(
            df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326"
        )
    
    raise ValueError("The provided DataFrame lacks required 'lon' or 'lat' columns for spatial conversion.")


def export_to_csv(data_package: CrimeDataPackage, output_dir: str = ".") -> bool:
    """Exports the structured dataframe to a standard CSV file.

    Args:
        data_package: A CrimeDataPackage wrapper containing the target DataFrame and metadata.
        output_dir: The destination directory for the exported file. Defaults to current directory.

    Returns:
        bool: True if export succeeds, False otherwise.
    """
    df = data_package.df
    month = data_package.month
    year = data_package.year
    
    filename = f"stl_crime_data_{month:02d}_{year}.csv"
    full_path = os.path.join(output_dir, filename)
    
    try:
        # If geometry somehow sneaked back into the dataframe, drop it safely
        df_to_export = df.drop(columns=["geometry"], errors="ignore")
        df_to_export.to_csv(full_path, index=False)
        logger.info("CSV successfully written to %s", full_path)
        return True
    except PermissionError:
        logger.error("Cannot write CSV. Is %s open in Excel?", full_path)
        return False
    except Exception as e:
        logger.error("Error exporting CSV to %s: %e", full_path, e)
        return False


def export_to_geojson(data_package: CrimeDataPackage, output_dir: str = ".") -> bool:
    """Reconstructs spatial points and exports to a standardized GeoJSON file.

    Args:
        data_package: A CrimeDataPackage wrapper containing the target DataFrame and metadata.
        output_dir: The destination directory for the exported file. Defaults to current directory.

    Returns:
        bool: True if export succeeds, False otherwise.
    """
    df = data_package.df
    month = data_package.month
    year = data_package.year

    filename = f"stl_crime_data_{month:02d}_{year}.geojson"
    full_path = os.path.join(output_dir, filename)
    
    try:
        gdf = _build_spatial_gdf(df)
        gdf.to_file(full_path, driver="GeoJSON")
        logger.info("GeoJSON successfully written to %s", full_path)
        return True
    except Exception as e:
        logger.error("Error exporting GeoJSON to %s: %e", full_path, e)
        return False


def export_to_gpkg(data_package: CrimeDataPackage, output_dir: str = ".") -> bool:
    """Reconstructs spatial points and exports to a standardized GeoPackage layer.

    Args:
        data_package: A CrimeDataPackage wrapper containing the target DataFrame and metadata.
        output_dir: The destination directory for the exported file. Defaults to current directory.

    Returns:
        bool: True if export succeeds, False otherwise.
    """
    df = data_package.df
    month = data_package.month
    year = data_package.year

    filename = f"stl_crime_data_{month:02d}_{year}.gpkg"
    full_path = os.path.join(output_dir, filename)
    layer_name = f"stl_crime_{month:02d}_{year}"
    
    try:
        gdf = _build_spatial_gdf(df)
        gdf.to_file(full_path, driver="GPKG", layer=layer_name)
        logger.info("GeoPackage successfully written to %s (Layer: %s)", full_path, layer_name)
        return True
    except PermissionError:
        logger.error("Cannot write GPKG. Is %s locked by GIS software?", full_path)
        return False
    except Exception as e:
        logger.error("Error exporting GeoPackage to %s: %e", full_path, e)
        return False
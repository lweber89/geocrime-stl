import os
import logging
import pandas as pd
import geopandas as gpd

logging.basicConfig(level=logging.INFO)

def export_to_csv(data_package: tuple, output_dir: str = ".") -> bool:
    """
    Exports the dataframe to a standardized CSV file.
    """

    #Unpack the data package, set local variables

    df = data_package.df
    month = data_package.month
    year = data_package.year
    
    # Format month to always be 2 digits (e.g., 4 -> '04')
    
    filename = f"stl_crime_data_{month:02d}_{year}.csv"
    full_path = os.path.join(output_dir, filename)
    
    try:
        # Drop geometry column for pure CSV if it exists
        df_to_export = df.drop(columns=['geometry']) if 'geometry' in df.columns else df
        
        df_to_export.to_csv(full_path, index=False)
        logging.info(f"CSV successfully written to {full_path}")
        return True
    except PermissionError:
        logging.error(f"Cannot write CSV. Is {full_path} open in Excel?")
        return False
    except Exception as e:
        logging.error(f"Error exporting CSV to {full_path}: {e}")
        return False


def export_to_geojson(data_package: tuple, output_dir: str = ".") -> bool:
    """
    Exports the dataframe to a standardized GeoJSON file.

    """
    #Unpack the data package, set local variables

    df = data_package.df
    month = data_package.month
    year = data_package.year

    #Convert to gdf in prep for conversion to GPKG
    
    gdf = gpd.GeoDataFrame(
        df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326"
    )

    #Prepare the filename (tagging with month and year from data_package)

    filename = f"stl_crime_data_{month:02d}_{year}.geojson"
    full_path = os.path.join(output_dir, filename)
    
    try:
        # Quick fallback check just in case CRS wasn't set by the cleaner
        if hasattr(gdf, 'crs') and gdf.crs is None:
            logging.warning("No CRS detected. Defaulting to EPSG:4326 for GeoJSON.")
            gdf = gdf.set_crs("EPSG:4326")
            
        gdf.to_file(full_path, driver="GeoJSON")
        logging.info(f"GeoJSON successfully written to {full_path}")
        return True
    except Exception as e:
        logging.error(f"Error exporting GeoJSON to {full_path}: {e}")
        return False


def export_to_gpkg(data_package: tuple, output_dir: str = ".") -> bool:
    """
    Exports the dataframe to a standardized GeoPackage file.

    """
    df = data_package.df
    month = data_package.month
    year = data_package.year

    #Convert to gdf in prep for conversion to GPKG

    gdf = gpd.GeoDataFrame(
    df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326"
    )

    #Prepare the filename (tagging with month and year from data_package)

    filename = f"stl_crime_data_{month:02d}_{year}.gpkg"

    full_path = os.path.join(output_dir, filename)
    
    # Layer name inside the GPKG can match the filename pattern for clarity
    
    layer_name = f"stl_crime_{month:02d}_{year}"
    
    try:
        gdf.to_file(full_path, driver="GPKG", layer=layer_name)
        logging.info(f"GeoPackage successfully written to {full_path} (Layer: {layer_name})")
        return True
    except PermissionError:
        logging.error(f"Cannot write GPKG. Is {full_path} locked by GIS software?")
        return False
    except Exception as e:
        logging.error(f"Error exporting GeoPackage to {full_path}: {e}")
        return False
import pandas as pd
import geopandas as gpd

def fetch_stl_crime_data(url):
    """Downloads CSV from SLMPD with necessary headers."""
    headers = {'User-Agent': 'Mozilla/5.0'}
    return pd.read_csv(url, storage_options=headers)

def clean_crime_dataframe(df, month=4, year=2026):
    """Handles date conversion, filtering, and coordinate cleanup."""
    # Convert dates
    df['IncidentDate'] = pd.to_datetime(df['IncidentDate'], format='%m/%d/%Y', exact=False)
    
    # Filter by time
    df_filtered = df[(df['IncidentDate'].dt.month == month) & 
                     (df['IncidentDate'].dt.year == year)].copy()
    
    # Force coordinates to numbers and drop invalid ones
    df_filtered['Longitude'] = pd.to_numeric(df_filtered['Longitude'], errors='coerce')
    df_filtered['Latitude'] = pd.to_numeric(df_filtered['Latitude'], errors='coerce')
    
    return df_filtered.dropna(subset=['Longitude', 'Latitude'])

def create_geodataframe(df, boundary_path=None):
    """Converts DataFrame to GeoDataFrame and optionally clips to boundary."""
    gdf = gpd.GeoDataFrame(
        df, 
        geometry=gpd.points_from_xy(df.Longitude, df.Latitude),
        crs="EPSG:4326"
    )
    
    if boundary_path:
        stl_boundary = gpd.read_file(boundary_path).to_crs("EPSG:4326")
        gdf = gpd.sjoin(gdf, stl_boundary, predicate='within')
    
    return gdf
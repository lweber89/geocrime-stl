import pandas as pd
import geopandas as gpd
import re

def extract_date_from_url(url):
    """
    Parses 'April2026' from '.../April2026.csv' 
    Returns: (month_int, year_int)
    """
    # Regex to find MonthNameYear (e.g., April2026)
    match = re.search(r'([a-zA-Z]+)(\d{4})', url)
    if not match:
        raise ValueError(f"Could not parse Month/Year from URL: {url}")
    
    month_name, year = match.groups()
    
    # Map name to number
    months = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    }
    
    return months[month_name.capitalize()], int(year)

def fetch_and_clean_stl_crime(url):
    """The new 'all-in-one' function to replace manual steps."""
    # Step 1: Get parameters from the URL itself
    month, year = extract_date_from_url(url)
    
    # Step 2: Fetch
    headers = {'User-Agent': 'Mozilla/5.0'}
    df = pd.read_csv(url, storage_options=headers)
    
    # Step 3: Clean (using extracted month/year)
    df['IncidentDate'] = pd.to_datetime(df['IncidentDate'], format='%m/%d/%Y', exact=False)
    
    df_filtered = df[(df['IncidentDate'].dt.month == month) & 
                     (df['IncidentDate'].dt.year == year)].copy()
    
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
import pandas as pd
import geopandas as gpd
import re

def extract_date_from_url(url):
    """
    Parses Month and Year from provided URL (case-insensitive, handles optional underscores)
    Returns: (month_int, year_int)
    """
    match = re.search(r'([a-zA-Z]+)_?(\d{4})', url)
    if not match:
        raise ValueError(f"Could not parse Month/Year from URL: {url}")
    
    month_name, year = match.groups()
    
    months = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12
    }
    
    # Lowercase lookup makes it more resilient to URL changes
    return months[month_name.lower()], int(year)

def fetch_and_clean_stl_crime(url):
    """Fetches, cleans, and filters crime data based on URL metadata."""
    month, year = extract_date_from_url(url)
    
    headers = {'User-Agent': 'Mozilla/5.0'}
    df = pd.read_csv(url, storage_options=headers)
    
    # 1. Parse IncidentDate cleanly
    df['IncidentDate'] = pd.to_datetime(df['IncidentDate'], format='%m/%d/%Y', exact=False, errors='coerce')
    
    # 2. Filter by date using the robust IncidentDate first
    df_filtered = df[(df['IncidentDate'].dt.month == month) & 
                     (df['IncidentDate'].dt.year == year)].copy()
    
    # 3. Build full timestamp safely, ignoring or filling missing times
    df_filtered['OccurredFromTime'] = df_filtered['OccurredFromTime'].fillna('00:00')
    df_filtered['Date_time'] = pd.to_datetime(
        df_filtered['IncidentDate'].dt.strftime('%Y-%m-%d') + ' ' + df_filtered['OccurredFromTime'].astype(str),
        errors='coerce'
    )
    
    # 4. Clean coordinates
    df_filtered['Longitude'] = pd.to_numeric(df_filtered['Longitude'], errors='coerce')
    df_filtered['Latitude'] = pd.to_numeric(df_filtered['Latitude'], errors='coerce')
    
    return df_filtered.dropna(subset=['Longitude', 'Latitude'])

def create_geodataframe(df, boundary_path=None):
    """Converts DataFrame to GeoDataFrame and optionally clips to boundary."""
    # Create the GeoDataFrame using standard Lat/Lon
    gdf = gpd.GeoDataFrame(
        df, 
        geometry=gpd.points_from_xy(df.Longitude, df.Latitude),
        crs="EPSG:4326"
    )
    
    if boundary_path:
        # Load and ensure boundary matches the points' projection
        stl_boundary = gpd.read_file(boundary_path).to_crs("EPSG:4326")
        
        # 'how="inner"' drops points outside the boundary. 
        # Using a selective column join prevents your df from getting cluttered with boundary attributes.
        gdf = gpd.sjoin(gdf, stl_boundary[['geometry']], how='inner', predicate='within')
        
        # Clean up the index created by sjoin
        if 'index_right' in gdf.columns:
            gdf = gdf.drop(columns=['index_right'])
    
    return gdf
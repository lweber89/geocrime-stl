# Group 1: Standard Libraries
from datetime import datetime
import io
import os

# Group 2: Third-Party Libraries
import geopandas as gpd
import pandas as pd
import requests



def construct_url(month: str = None, year: str = None):
    """
    Constructs a URL based on the provided month and year.
    Defaults to the most recent completed month and year if none are provided.
    """
    # 1. Establish the default "last month" baseline to handle lag and year rollovers
    now = datetime.now()
    if now.month == 1:
        default_month = 12
        default_year = now.year - 1
    else:
        default_month = now.month - 1
        default_year = now.year

    # 2. Use default year if none provided, otherwise parse user input
    if year is None:
        year_int = default_year
        year_str = str(year_int)
    else:
        year_str = str(year).strip()
        year_int = int(year_str)
        
    # 3. Use default month if none provided, otherwise parse user input
    if month is None:
        month_int = default_month
        month_name = datetime.strptime(str(month_int), "%m").strftime("%B")
    else:
        try:
            month_int = int(month)
            month_name = datetime.strptime(str(month_int), "%m").strftime("%B")
        except ValueError:
            month_name = str(month).strip().capitalize()
            month_int = datetime.strptime(month_name, "%B").month

    # 4. Calculate the upload folder string (always 1 month ahead of data month)
    folder_int = (month_int % 12) + 1
    folder_str = f"{folder_int:02d}"

    # 5. Construct and return final values
    base_url = "https://slmpd.org/wp-content/uploads"
    return f"{base_url}/{year_str}/{folder_str}/{month_name}{year_str}.csv", month_int, year_int

def fetch_and_clean(month=None, year=None, keep_raw_csv=False):
    # 1. Generate the target URL
    url, month_int, year_int = construct_url(month, year)
    
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    # 2. Extract the file name from the URL for saving later if requested
    filename = url.split('/')[-1] 
    
    print(f"Attempting to fetch data from: {url}")
    
    try:
        # 3. Use requests first to safely check the server's response
        response = requests.get(url, headers=headers, timeout=10)
        
        # This raises an HTTPError if the status is 404, 500, etc.
        response.raise_for_status() 
        
    except requests.exceptions.HTTPError as http_err:
        print(f"❌ HTTP error occurred: {http_err} (Check if the month/year exists yet)")
        return None
    except requests.exceptions.ConnectionError:
        print("❌ Connection error: Could not reach the server. Check your internet connection.")
        return None
    except requests.exceptions.Timeout:
        print("❌ Timeout error: The server took too long to respond.")
        return None
    except Exception as e:
        print(f"❌ An unexpected error occurred while fetching the file: {e}")
        return None

    # 4. Handle the raw CSV save state
    if keep_raw_csv:
        try:
            with open(filename, 'wb') as f:
                f.write(response.content)
            print(f"💾 Raw CSV successfully saved locally as: {filename}")
        except IOError as io_err:
            print(f"⚠️ Could not save raw CSV file locally: {io_err}")

    # 5. Load the downloaded content into Pandas safely using an in-memory string buffer
    try:
        # io.StringIO decodes the raw bytes into a text stream Pandas can read
        csv_data = io.StringIO(response.content.decode('utf-8'))
        df = pd.read_csv(csv_data)
        
        if df.empty:
            print("⚠️ Warning: The CSV file was successfully downloaded but contains no data.")
            return df
            
        print(f"✅ Data successfully loaded into DataFrame. Shape: {df.shape}")
    
    except Exception as e:
        print(f"❌ Error parsing the CSV data into Pandas: {e}")
        return None
    
    # 1. Parse IncidentDate cleanly
    df['IncidentDate'] = pd.to_datetime(df['IncidentDate'], format='%m/%d/%Y', exact=False, errors='coerce')
    
    # 2. Filter by date using the robust IncidentDate first
    df_filtered = df[(df['IncidentDate'].dt.month == month_int) & 
                     (df['IncidentDate'].dt.year == year_int)].copy()
    
    # 3. Build full timestamp safely, ignoring or filling missing times
    df_filtered['OccurredFromTime'] = df_filtered['OccurredFromTime'].fillna('00:00')
    df_filtered['date_time'] = pd.to_datetime(
        df_filtered['IncidentDate'].dt.strftime('%Y-%m-%d') + ' ' + df_filtered['OccurredFromTime'].astype(str),
        errors='coerce'
    )
    
    # Rename Columns

    df_filtered = df_filtered.rename(columns={
        'Latitude': 'lat',
        'Longitude': 'lon',
        'IncidentNum': 'inc_#',
        'NIBRS': 'nibrs_code',
        'NIBRSCategory': 'nibrs_cat',
        'CrimeAgainst': 'off_type',
        'IncidentLocation': 'address',
        'District': 'district',
        'Neighborhood': 'nbhd',
        'NbhdNum': 'nbhd_num',
        'FirearmUsed': 'firearm',
        'IncidentNature': 'inc_desc',
        'Offense': 'offense'
    })

    # Drop unneeded columns
    df_filtered = df_filtered.drop(columns=[
        'IncidentDate',
        'OccurredFromTime',
        'SRS_UCR',
        'IncidentTopSRS_UCR',
        'IntersectionOtherLoc',
        'IncidentSupplemented',
        'LastSuppDate',
        'VictimNum',
        'FelMisdCit'
    ], errors='ignore')

    # Convert inc_# and district to strings

    # 3. THIS IS THE SPOT: Clean and cast your data types safely
    # First, force everything to a number, turning typos/strings into NaN safely
    df_filtered['district'] = pd.to_numeric(df_filtered['district'], errors='coerce')

    # Now that strings/typos are gone, convert safely to Int64, then string
    df_filtered['district'] = df_filtered['district'].astype('Int64').astype('string')

    df_filtered['inc_#'] = df_filtered['inc_#'].astype('string')

    # Replace 
    df_filtered['off_type'] = df_filtered['off_type'].replace('Unspecified', 'Other')


    # Clean coordinates and establish cleaned pandas data frame
    df_filtered['lon'] = pd.to_numeric(df_filtered['lon'], errors='coerce')
    df_filtered['lat'] = pd.to_numeric(df_filtered['lat'], errors='coerce')
    
    cleaned_df = df_filtered.dropna(subset=['lon', 'lat'])

    target_cols = ['inc_#', 'date_time', 'nibrs_cat', 'nibrs_code', 'offense', 'inc_desc', 'off_type', 'firearm', 'address', 'nbhd', 'nbhd_num', 'district', 'lat', 'lon']

    # Only keep the ones that actually exist in cleaned_df right now
    existing_cols = [col for col in target_cols if col in cleaned_df.columns]
    cleaned_df = cleaned_df[existing_cols]


    #Call to clip_df to identify and drop points that are outside boundary
    #Return a clean, clipped pandas datadrame
    try:
        return clip_df(cleaned_df)
    except Exception as e:
        print(f"⚠️ Spatial clipping bypassed due to error: {e}")
        print("▶️ Returning full, unclipped St. Louis metropolitan area dataset.")
        return cleaned_df


def clip_df(df):
    """Converts DataFrame to GeoDataFrame and clips to boundary."""
    
    # Strategy A: Check relative to where this specific python file is located
    base_dir = os.path.dirname(os.path.abspath(__file__))
    boundary_path = os.path.join(base_dir, 'data', 'stl_boundary.geojson')

    # Strategy B: UPDATED FOR REALITY — Look at root-level data/ folder
    if not os.path.exists(boundary_path):
        # Solves the 'peer folder' layout: geocrime-stl/data/stl_boundary.geojson
        boundary_path = os.path.join(os.getcwd(), 'data', 'stl_boundary.geojson')

    # Ultimate Safety Check
    if not os.path.exists(boundary_path):
        raise FileNotFoundError(
            f"❌ Could not locate 'stl_boundary.geojson' automatically.\n"
            f"Please verify the file exists at your repository path:\n"
            f"data/stl_boundary.geojson"
        )
    # Create a geodataframe using standard Lat/Lon
    gdf = gpd.GeoDataFrame(
        df, 
        geometry=gpd.points_from_xy(df.lon, df.lat),
        crs="EPSG:4326"
    )
    
    # Bring in the clipping boundary
    stl_boundary = gpd.read_file(boundary_path).to_crs("EPSG:4326")

    # Clip the data to the clipping boundary
    gdf = gpd.sjoin(gdf, stl_boundary[['geometry']], how='inner', predicate='within')
        
    # Clean up the index created by sjoin
    if 'index_right' in gdf.columns:
        gdf = gdf.drop(columns=['index_right'])
    
    # Drop the geometry and return a pandas dataframe
    clipped_df = gdf.drop(columns=['geometry'])

    return clipped_df
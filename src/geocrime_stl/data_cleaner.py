from __future__ import annotations

# Group 1: Standard Libraries
from dataclasses import dataclass
from datetime import datetime
import io
import os
import sys

# Group 2: Third-Party Libraries
import geopandas as gpd
import pandas as pd
import requests


@dataclass
class CrimeDataPackage:
    """Wrapper that bundles monthly crime data with its temporal metadata."""

    df: pd.DataFrame
    month: int
    year: int


def construct_url(
    month: str | int | None = None, year: str | int | None = None
) -> tuple[str, int, int]:
    """Constructs a URL pointing to the SLMPD monthly data uploads based on inputs.

    Defaults to the most recent completed month and year if none are provided.
    Exits cleanly if invalid inputs are provided.
    """
    try:
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
            clean_month = str(month).strip()

            try:
                # Case A: Input is an integer/digit string (e.g., "12" or 12)
                month_int = int(clean_month)
                month_name = datetime.strptime(str(month_int), "%m").strftime(
                    "%B"
                )
            except ValueError:
                # Case B: Input is a string name (e.g., "December" or "Dec")
                try:
                    dt = datetime.strptime(clean_month.capitalize(), "%B")
                except ValueError:
                    dt = datetime.strptime(clean_month.capitalize(), "%b")

                month_int = dt.month
                month_name = dt.strftime("%B")

        # 4. Calculate the upload folder string (always 1 month ahead of data month)
        folder_int = (month_int % 12) + 1
        folder_month_str = f"{folder_int:02d}"

        # Calculate year if December (advance 1 year)
        if month_int == 12:
            folder_year_str = str(year_int + 1)
        else:
            folder_year_str = year_str

        # 5. Construct and return final values
        base_url = "https://slmpd.org/wp-content/uploads"
        url = f"{base_url}/{folder_year_str}/{folder_month_str}/{month_name}{year_str}.csv"

        return url, month_int, year_int

    except Exception as e:
        print(
            f"❌ Error: Invalid month ('{month}') or year ('{year}') provided. Details: {e}"
        )
        sys.exit(1)


def fetch_and_clean(
    month: str | int | None = None,
    year: str | int | None = None,
    keep_raw_csv: bool = False,
) -> CrimeDataPackage | None:
    """Fetches SLMPD monthly crime CSV, filters data to targeted dates, renames data

    schemas, drops invalid coordinates, and applies neighborhood clipping.

    Returns:
        CrimeDataPackage if successful, None if a network or retrieval error
        occurs.
    """
    # 1. Generate the target URL
    url, month_int, year_int = construct_url(month, year)

    headers = {"User-Agent": "Mozilla/5.0"}
    filename = url.split("/")[-1]

    print(f"Attempting to fetch data from: {url}")

    try:
        # 3. Use requests first to safely check the server's response
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

    except requests.exceptions.HTTPError as http_err:
        print(
            f"❌ HTTP error occurred: {http_err} (Check if the month/year exists yet)"
        )
        return None
    except requests.exceptions.ConnectionError:
        print(
            "❌ Connection error: Could not reach the server. Check your internet connection."
        )
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
            with open(filename, "wb") as f:
                f.write(response.content)
            print(f"💾 Raw CSV successfully saved locally as: {filename}")
        except IOError as io_err:
            print(f"⚠️ Could not save raw CSV file locally: {io_err}")

    # 5. Load downloaded content safely into an in-memory string buffer
    try:
        csv_data = io.StringIO(response.content.decode("utf-8"))
        df = pd.read_csv(csv_data)

        if df.empty:
            print(
                "⚠️ Warning: The CSV file was successfully downloaded but contains no data."
            )
            return CrimeDataPackage(df=df, month=month_int, year=year_int)

        print(f"✅ Data successfully loaded into DataFrame. Shape: {df.shape}")

    except Exception as e:
        print(f"❌ Error parsing the CSV data into Pandas: {e}")
        return None

    # 6. Process and Parse IncidentDate
    df["IncidentDate"] = pd.to_datetime(
        df["IncidentDate"], format="%m/%d/%Y", exact=False, errors="coerce"
    )

    # 7. Filter by date alignment
    df_filtered = df[
        (df["IncidentDate"].dt.month == month_int)
        & (df["IncidentDate"].dt.year == year_int)
    ].copy()

    # 8. Build full timestamp safely
    df_filtered["OccurredFromTime"] = df_filtered["OccurredFromTime"].fillna(
        "00:00"
    )
    df_filtered["date_time"] = pd.to_datetime(
        df_filtered["IncidentDate"].dt.strftime("%Y-%m-%d")
        + " "
        + df_filtered["OccurredFromTime"].astype(str),
        errors="coerce",
    )

    # Schema Remapping
    df_filtered = df_filtered.rename(
        columns={
            "Latitude": "lat",
            "Longitude": "lon",
            "IncidentNum": "inc_#",
            "NIBRS": "nibrs_code",
            "NIBRSCategory": "nibrs_cat",
            "CrimeAgainst": "off_type",
            "IncidentLocation": "address",
            "District": "district",
            "Neighborhood": "nbhd",
            "NbhdNum": "nbhd_num",
            "FirearmUsed": "firearm",
            "IncidentNature": "inc_desc",
            "Offense": "offense",
        }
    )

    # Drop unneeded columns
    df_filtered = df_filtered.drop(
        columns=[
            "IncidentDate",
            "OccurredFromTime",
            "SRS_UCR",
            "IncidentTopSRS_UCR",
            "IntersectionOtherLoc",
            "IncidentSupplemented",
            "LastSuppDate",
            "VictimNum",
            "FelMisdCit",
        ],
        errors="ignore",
    )

    # Clean and cast your data types safely
    df_filtered["district"] = pd.to_numeric(
        df_filtered["district"], errors="coerce"
    )
    df_filtered["district"] = (
        df_filtered["district"].astype("Int64").astype("string")
    )
    df_filtered["inc_#"] = df_filtered["inc_#"].astype("string")

    # =========================================================================
    # 🔥 FIX: STRIP PREFIXES (G-88, etc.) AND FORCE NEIGHBORHOOD ID TO INT
    # =========================================================================
    df_filtered["nbhd_num"] = (
        df_filtered["nbhd_num"]
        .astype(str)
        .str.extract(r"(\d+)", expand=False)
    )
    df_filtered["nbhd_num"] = pd.to_numeric(
        df_filtered["nbhd_num"], errors="coerce"
    ).astype("Int64")
    # =========================================================================


    # Normalize classifications
    df_filtered["off_type"] = df_filtered["off_type"].replace(
        "Unspecified", "Other"
    )

    # Clean coordinates
    df_filtered["lon"] = pd.to_numeric(df_filtered["lon"], errors="coerce")
    df_filtered["lat"] = pd.to_numeric(df_filtered["lat"], errors="coerce")
    cleaned_df = df_filtered.dropna(subset=["lon", "lat"])

    target_cols = [
        "inc_#",
        "date_time",
        "nibrs_cat",
        "nibrs_code",
        "offense",
        "inc_desc",
        "off_type",
        "firearm",
        "address",
        "nbhd",
        "nbhd_num",
        "district",
        "lat",
        "lon",
    ]
    existing_cols = [col for col in target_cols if col in cleaned_df.columns]
    cleaned_df = cleaned_df[existing_cols]

    # Geofenced Boundary Clipping
    try:
        cleaned_df = clip_df(cleaned_df)
        return CrimeDataPackage(df=cleaned_df, month=month_int, year=year_int)
    except Exception as e:
        print(f"⚠️ Spatial clipping bypassed due to error: {e}")
        print(
            "▶️ Returning full, unclipped St. Louis metropolitan area dataset."
        )
        return CrimeDataPackage(df=cleaned_df, month=month_int, year=year_int)


def clip_df(df: pd.DataFrame) -> pd.DataFrame:
    """Performs an inner spatial join to restrict observations to the formal St.

    Louis city boundaries using EPSG:4326 coordinate systems.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    boundary_path = os.path.join(base_dir, "data", "stl_boundary.geojson")

    if not os.path.exists(boundary_path):
        boundary_path = os.path.join(
            os.getcwd(), "data", "stl_boundary.geojson"
        )

    if not os.path.exists(boundary_path):
        raise FileNotFoundError(
            f"❌ Could not locate 'stl_boundary.geojson' automatically.\n"
            f"Please verify the file exists at your repository path:\n"
            f"data/stl_boundary.geojson"
        )

    gdf = gpd.GeoDataFrame(
        df, geometry=gpd.points_from_xy(df.lon, df.lat), crs="EPSG:4326"
    )

    stl_boundary = gpd.read_file(boundary_path).to_crs("EPSG:4326")
    gdf = gpd.sjoin(
        gdf, stl_boundary[["geometry"]], how="inner", predicate="within"
    )

    if "index_right" in gdf.columns:
        gdf = gdf.drop(columns=["index_right"])

    clipped_df = gdf.drop(columns=["geometry"])
    return clipped_df
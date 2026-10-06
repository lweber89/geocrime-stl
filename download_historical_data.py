#!/usr/bin/env python3
"""Baseline Builder Script: SLMPD Historical Pipeline Trigger.

Description: Iterates over a date range from a fixed historical start point 
up to the most recently completed month relative to today, and compiles 
a master baseline GeoParquet and GeoJSON dataset.
"""

from __future__ import annotations

import logging
import sys
import time
from datetime import datetime
from pathlib import Path

import geopandas as gpd
import pandas as pd
from dateutil.relativedelta import relativedelta

# Import the unified storefront engine and centralized config path
import geocrime_stl as gc

# Setup minimal logging
logging.basicConfig(level=logging.WARNING, format="%(levelname)s - %(message)s")


def run_historical_backfill() -> None:
    """Executes the historical backfill loop, compiles all monthly crime packages,

    and outputs consolidated GeoParquet and GeoJSON files for public streaming.
    """
    # Set the fixed historical starting point (May 2024)
    start_date = datetime(2024, 5, 1)  # noqa: DTZ001
    
    # Dynamic End Date: Calculate the most recently completed month relative to today
    today = datetime.now()  # noqa: DTZ005
    end_date = datetime(today.year, today.month, 1) - relativedelta(months=1)  # noqa: DTZ001
    
    # Initialize a completely empty DataFrame to hold cumulative data
    baseline_df = pd.DataFrame()
    current_date = start_date

    print("🚀 Starting SLMPD Historical Baseline Pipeline utilizing geocrime_stl...")
    print(f"Execution Date: {today.strftime('%B %d, %Y')}")
    print(f"Targeting Range: {start_date.strftime('%B %Y')} ──> {end_date.strftime('%B %Y')}\n")

    # Execute the core extraction loop
    while current_date <= end_date:
        m_int = current_date.month
        y_int = current_date.year

        print(
            f"🔄 Fetching, cleaning, & geo-fencing: {m_int:02d}/{y_int}...",
            end="",
            flush=True,
        )

        try:
            # Trigger the optimized facade engine (returns a CrimeDataPackage)
            package = gc.run_pipeline(month=m_int, year=y_int)
            month_df = package.df

            if not month_df.empty:
                # Safely append rows to historical DataFrame
                baseline_df = pd.concat([baseline_df, month_df], ignore_index=True)
                print(
                    f"   ✅ Success! Added {len(month_df):,} rows. (Cumulative Total: {len(baseline_df):,})"
                )
            else:
                # Engine safely returned an empty df if a file is missing or empty
                print(
                    "   ⚠️️ Warning: No records found or asset hasn't been published."
                )

        except Exception as e:  # noqa: BLE001
            # Catch unexpected structural dropouts safely without killing the entire pipeline loop
            print(f"   ❌ Critical failure on this month loop! Error: {e}")
            sys.exit(1)

        # Polite 2-second breathing room for the SLMPD web server
        time.sleep(2)
        current_date += relativedelta(months=1)

    # Export compiled dataset to GeoParquet and GeoJSON
    print("\n--- Pipeline Execution Complete ---")
    if not baseline_df.empty:
        filename = "slmpd_crime_data.parquet"
        
        print(
            f"💾 Committing all {len(baseline_df):,} rows to GeoParquet and GeoJSON formats..."
        )
        
        # Convert the standard DataFrame to a GeoDataFrame using lat and lon columns
        gdf = gpd.GeoDataFrame(
            baseline_df, 
            geometry=gpd.points_from_xy(baseline_df["lon"], baseline_df["lat"]), 
            crs="EPSG:4326"
        )

        # Ensure the output directory exists, then clean out old files safely
        output_dir = Path("./crime_data")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        for file in output_dir.iterdir():
            if file.is_file():
                file.unlink()
        
        # Write out to GeoParquet format
        output_path = output_dir / filename
        gdf.to_parquet(output_path, compression="snappy", index=False)

        # Write out to GeoJSON format
        gdf.to_file(output_dir / "slmpd_crime_data.geojson", driver="GeoJSON")
        
        print(f"🎉 Historical baseline files successfully created at: {output_dir}")
    else:
        print(
            "❌ Script finished but no data was collected. Historical baseline files were not created."
        )


if __name__ == "__main__":
    try:
        run_historical_backfill()
    except KeyboardInterrupt:
        print("\n🛑 Process interrupted by user. Exiting cleanly.")
        sys.exit(1)
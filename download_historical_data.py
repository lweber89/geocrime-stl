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

import pandas as pd
from dateutil.relativedelta import relativedelta

# Import the unified storefront engine and centralized config path
import geocrime_stl as gc
from geocrime_stl.config import MASTER_GEOJSON, MASTER_PARQUET
from geocrime_stl.utils.dataset import save_master
from geocrime_stl.utils.web_export import WebExportError, build_web_feed

# Setup minimal logging
logging.basicConfig(level=logging.WARNING, format="%(levelname)s - %(message)s")


def run_historical_backfill() -> None:
    """Executes the historical backfill loop, compiles all monthly crime packages,

    and outputs the master GeoParquet/GeoJSON files plus the dashboard's monthly JSON feed.
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
        print(
            f"💾 Committing all {len(baseline_df):,} rows to GeoParquet and GeoJSON formats..."
        )

        # Build the dashboard feed first: it validates the data, so a bad backfill is caught
        # before any existing master files are overwritten.
        try:
            manifest = build_web_feed(baseline_df)
        except WebExportError as err:
            print(f"❌ Dashboard feed was not built, and no files were changed: {err}")
            sys.exit(1)

        # Overwrites the two master files in place; nothing else in the folder is touched.
        save_master(baseline_df)

        print(f"🎉 Master dataset written: {MASTER_PARQUET.parent}")
        print(f"   {MASTER_PARQUET.name}, {MASTER_GEOJSON.name}")
        print(f"🌐 Dashboard feed: {len(manifest['months'])} months through {manifest['through']}")
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
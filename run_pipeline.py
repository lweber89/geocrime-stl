#!/usr/bin/env python3
"""Automation script for orchestrating the monthly ETL pipeline and saving Parquet outputs."""

from __future__ import annotations

import logging
import sys
from datetime import datetime

# Import the single orchestrator
from geocrime_stl import run_pipeline as execute_engine
from geocrime_stl.config import MASTER_PARQUET, PROCESSED_DIR
from geocrime_stl.etl.extract import ExtractionError
from geocrime_stl.utils.dataset import load_master, merge_month, save_master
from geocrime_stl.utils.web_export import WebExportError, build_web_feed

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("etl_pipeline")


def run_monthly_etl(month: int, year: int) -> None:
    """Orchestrates the full automated E -> T -> L lifecycle.

    Accepts strict integer parameters, runs the engine, and handles file saving.

    Args:
        month: The numerical month (1-12) to process.
        year: The four-digit year to process.
    """
    logger.info("🚀 Kicking off automated ETL for period %d/%d...", month, year)

    try:
        # =====================================================================
        # Phases 1 & 2: ENGINE EXECUTION (Delegated entirely to the package)
        # =====================================================================
        package = execute_engine(month=month, year=year)
        final_df = package.df

        # =====================================================================
        # Phase 3: LOAD PHASE (File IO / Disk Storage)
        # =====================================================================
        logger.info("--- Phase 3: Loading ---")
        
        if final_df.empty:
            logger.warning(
                "⚠️ Engine finished successfully, but 0 records were parsed for %d/%d.",
                month,
                year,
            )
        else:
            # 1. Keep this month's cleaned rows as a standalone Parquet file (an archive of the run)
            monthly_dir = PROCESSED_DIR / "monthly"
            monthly_dir.mkdir(parents=True, exist_ok=True)
            output_path = monthly_dir / f"clean_crime_{year}_{month:02d}.parquet"
            final_df.to_parquet(output_path, index=False)
            logger.info("Saved %d records for %d/%d to: %s", len(final_df), month, year, output_path)

            # 2. Merge the month into the master dataset (replacing that month if it was already there)
            master = load_master()
            if master.empty:
                raise ValueError(
                    f"No master dataset at {MASTER_PARQUET}. "
                    "Run download_historical_data.py once to build the baseline first."
                )
            master = merge_month(master, final_df, month=month, year=year)

            # 3. Rebuild the dashboard's monthly JSON feed. This validates the data first, so a bad
            #    month raises here, before it is written into the master dataset.
            manifest = build_web_feed(master)

            # 4. Save the master dataset (GeoParquet + GeoJSON for GIS users)
            save_master(master)

            logger.info(
                "🎉 Success! Master dataset now has %d rows; dashboard feed covers %d months through %s.",
                len(master),
                len(manifest["months"]),
                manifest["through"],
            )

    except WebExportError as web_err:
        logger.error("🛑 Pipeline halted while building the dashboard feed (nothing was published): %s", web_err)
        sys.exit(1)

    except ExtractionError as ext_err:
        logger.error("🛑 Pipeline halted during Extraction phase: %s", ext_err)
        sys.exit(1)
        
    except ValueError as val_err:
        logger.error("🛑 Pipeline halted during DataFrame compilation: %s", val_err)
        sys.exit(1)
        
    except Exception as unexpected_err:
        logger.critical(
            "💥 Pipeline suffered a critical crash: %s", 
            unexpected_err, 
            exc_info=True
        )
        sys.exit(1)


if __name__ == "__main__":
    # Grab the current date right now
    now = datetime.now()

    # Automatically calculate the previous calendar month
    if now.month == 1:
        default_month = 12
        default_year = now.year - 1
    else:
        default_month = now.month - 1
        default_year = now.year

    # Fire off the automated ETL using the dynamic defaults
    run_monthly_etl(month=default_month, year=default_year)
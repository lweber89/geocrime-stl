#!/usr/bin/env python3
from __future__ import annotations

import logging
import sys

# 1. Import the single master orchestrator from your package storefront
from geocrime_stl import run_pipeline as execute_engine
from geocrime_stl.extract import ExtractionError

# Configure logging to give you a clean, timestamped console output
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("etl_pipeline")


# 2. Reduced, strict parameters for your automation script
def run_monthly_etl(
    month: int,
    year: int,
) -> None:
    """Orchestrates the full automated E -> T -> L lifecycle.
    
    Accepts strict integer parameters, runs the engine, and handles file saving.
    """
    logger.info(f"🚀 Kicking off automated ETL for period {month}/{year}...")

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
                f"⚠️ Engine finished successfully, but 0 records were parsed for {month}/{year}."
            )
        else:
            # Save out to high-performance Parquet automatically
            from geocrime_stl.config import DATA_DIR
            output_path = DATA_DIR / f"clean_crime_{year}_{month:02d}.parquet"
            
            final_df.to_parquet(output_path, index=False)
            
            logger.info(
                f"🎉 Success! Processed and saved {len(final_df)} GIS-ready records "
                f"to: {output_path}"
            )
            
    except ExtractionError as ext_err:
        logger.error(f"🛑 Pipeline halted during Extraction phase: {ext_err}")
        sys.exit(1)
        
    except ValueError as val_err:
        logger.error(f"🛑 Pipeline halted during DataFrame compilation: {val_err}")
        sys.exit(1)
        
    except Exception as unexpected_err:
        logger.critical(
            f"💥 Pipeline suffered a critical crash: {unexpected_err}", 
            exc_info=True
        )
        sys.exit(1)


if __name__ == "__main__":
    from datetime import datetime

    # 1. Grab the current date right now
    now = datetime.now()

    # 2. Automatically calculate the previous calendar month
    if now.month == 1:
        default_month = 12
        default_year = now.year - 1
    else:
        default_month = now.month - 1
        default_year = now.year

    # 3. Fire off the automated ETL using the dynamic defaults
    run_monthly_etl(month=default_month, year=default_year)
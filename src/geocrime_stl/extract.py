from __future__ import annotations

import logging
from datetime import datetime

import requests

from geocrime_stl.config import BASE_URL

logger = logging.getLogger(__name__)

class ExtractionError(Exception):
    """Raised if the target URL cannot be formed or network operations fail."""
    pass


def construct_url(
    month_input: str | int | None = None, 
    year_input: str | int | None = None
) -> tuple[str, int, int]:
    """Parses flexible date inputs and builds the target SLMPD data asset URL."""
    try:
        now = datetime.now()
        if now.month == 1:
            default_month = 12
            default_year = now.year - 1
        else:
            default_month = now.month - 1
            default_year = now.year

        # Parse year input into consistent types
        if year_input is None:
            year_int = default_year
            year_str = str(year_int)
        else:
            year_str = str(year_input).strip()
            year_int = int(year_str)

        # Parse month input into consistent types
        if month_input is None:
            month_int = default_month
            month_str = datetime.strptime(str(month_int), "%m").strftime("%B")
        else:
            clean_month = str(month_input).strip()
            try:
                month_int = int(clean_month)
                month_str = datetime.strptime(str(month_int), "%m").strftime("%B")
            except ValueError:
                try:
                    dt = datetime.strptime(clean_month.capitalize(), "%B")
                except ValueError:
                    dt = datetime.strptime(clean_month.capitalize(), "%b")
                month_int = dt.month
                month_str = dt.strftime("%B")

        # Handle the city's specific upload folder schedule offset
        folder_month_int = (month_int % 12) + 1
        folder_month_str = f"{folder_month_int:02d}"
        folder_year_str = str(year_int + 1) if month_int == 12 else year_str

        url = f"{BASE_URL}/{folder_year_str}/{folder_month_str}/{month_str}{year_str}.csv"
        return url, month_int, year_int

    except Exception as e:
        raise ExtractionError(f"Invalid month ('{month_input}') or year ('{year_input}') mapping: {e}") from e


def fetch_crime_data_csv(url: str, keep_raw_csv: bool = False) -> bytes:
    """Downloads raw network bytes. Standardized on 'keep_raw_csv' to match project rules."""
    headers = {"User-Agent": "Mozilla/5.0"}
    filename = url.split("/")[-1] or "downloaded_data.csv"

    logger.info(f"Attempting network download from: {url}")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        raw_bytes = response.content
    except requests.exceptions.HTTPError as http_err:
        raise ExtractionError(f"HTTP error downloading data asset: {http_err}") from http_err
    except requests.exceptions.RequestException as net_err:
        raise ExtractionError(f"Network transport error reaching server: {net_err}") from net_err
    except Exception as e:
        raise ExtractionError(f"Unexpected extraction execution failure: {e}") from e

    if keep_raw_csv:
        try:
            with open(filename, "wb") as f:
                f.write(raw_bytes)
            logger.info(f"💾 Raw CSV backup cached locally: {filename}")
        except IOError as io_err:
            logger.warning(f"⚠️ Could not write raw data local cache: {io_err}")

    return raw_bytes
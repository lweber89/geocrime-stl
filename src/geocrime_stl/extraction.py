
from __future__ import annotations

import sys

# 1. Standard Libraries (Alphabetized)
from datetime import datetime

# 2. Third-Party Libraries
import requests

# 3. Local Application Imports
from geocrime_stl import BASE_URL


def construct_url(
    month: str | int | None = None, year: str | int | None = None
) -> tuple[str, int, int]:

    try:
        # Establish the default "last month" baseline to handle lag and year rollovers
        now = datetime.now()
        if now.month == 1:
            default_month = 12
            default_year = now.year - 1
        else:
            default_month = now.month - 1
            default_year = now.year

        # Use default year if none provided, otherwise parse user input
        if year is None:
            year_int = default_year
            year_str = str(year_int)
        else:
            year_str = str(year).strip()
            year_int = int(year_str)

        # Use default month if none provided, otherwise parse user input
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

        # Calculate the upload folder string (always 1 month ahead of data month)
        folder_int = (month_int % 12) + 1
        folder_month_str = f"{folder_int:02d}"

        # Calculate year if December (advance 1 year)
        if month_int == 12:
            folder_year_str = str(year_int + 1)
        else:
            folder_year_str = year_str

        # Construct and return final values
        url = f"{BASE_URL}/{folder_year_str}/{folder_month_str}/{month_name}{year_str}.csv"

        return url, month_int, year_int

    except Exception as e:
        print(
            f"❌ Error: Invalid month ('{month}') or year ('{year}') provided. Details: {e}"
        )
        sys.exit(1)


def fetch_crime_data_csv(url: str, save_raw_csv: bool = False) -> bytes | None:
    """Fetches raw data from a URL, optionally saves it locally, and returns the raw bytes."""
    headers = {"User-Agent": "Mozilla/5.0"}
    filename = url.split("/")[-1] or "downloaded_data.csv"

    print(f"Attempting to fetch data from: {url}")

    # 1. Extract: Fetch the raw data from the server
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        raw_data = response.content  # This is the bytes object you need

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

    # 2. Optional: Cache/Save the raw CSV locally
    if save_raw_csv:
        try:
            with open(filename, "wb") as f:
                f.write(raw_data)
            print(f"💾 Raw CSV successfully saved locally as: {filename}")
        except IOError as io_err:
            print(f"⚠️ Could not save raw CSV file locally: {io_err}")

    # 3. Return: Hand over the raw bytes to the caller
    return raw_data
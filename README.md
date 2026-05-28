# geocrime-stl

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

A Python utility for cleaning and standardizing St. Louis Metropolitan Police Department (SLMPD) crime data for spatial analysis.

## ✨ Features

* **End-to-End ETL:** Fetch, clean, and standardize monthly SLMPD crime data files automatically.
* **Spatial Formats:** Convert cleaned DataFrames seamlessly into GeoJSON, GeoPackage (GPKG), or CSV.
* **Analysis Ready:** Access built-in methods for minimal data summarization and visualization.

## 🌐 Data Source & Disclaimer

This utility programmatically fetches publicly available crime data directly from the **[St. Louis Metropolitan Police Department (SLMPD) Stats Page](https://slmpd.org/stats/)**. 

⚠️ **Data Disclaimer & Limitations:**
* **Availability:** This tool relies entirely on the upstream availability and hosting structure of the SLMPD website. If their servers are down or their URL layout changes, the extraction pipeline may fail.
* **Data Integrity & Spatial Boundaries:** The data processed is strictly "as-is" from the published monthly files. To ensure high data quality for spatial analysis, this utility applies two strict filtering constraints:
  1. **Temporal Filtering:** Because the SLMPD frequently updates historical records retroactively, this utility isolates and preserves only the records belonging to the target month.
  2. **Spatial Clipping:** Records containing invalid, malformed, or erroneous latitude/longitude coordinates that plot completely outside the official St. Louis city boundaries are automatically dropped.
* **Project Status:** This is an independent, open-source utility. It is not affiliated with, endorsed by, or officially maintained by the SLMPD or the City of St. Louis.

## 🚀 Quick Start

### Install
``` bash
pip install geocrime-stl
```
### Fetch/Clean/Visualize Data
```python
import geocrime_stl as gc

data_pkg = gc.run_pipeline(4, 2026)

gc.generate_monthly_metrics(data_pkg)

gc.plot_monthly_maps(data_pkg)
```

## 🛠️ Local Setup (Alternative)

If you want to run the demo notebook locally or explore the source code, you can clone the repository directly:

```bash
git clone https://github.com/lweber89/geocrime-stl.git
cd geocrime-stl
pip install -e .
```

## 📓 Demo & Tutorial
To see a step-by-step walkthrough of the entire ETL process, check out the interactive Jupyter notebook:

👉 **[View the Demo Notebook](https://github.com/lweber89/geocrime-stl/blob/main/notebooks/demo.ipynb)**


## 🤝 Contributing & Pull Requests
Thank you for your interest in the project!

⚠️ Please Note: This is a personal project I developed and maintain in an effort to better understand the implementation of Python in geospatial data engineering / solutions architecture. I am not accepting pull requests or code contributions at this time.

If you find a bug or have an idea, feel free to open an Issue to let me know, or feel free to fork the repository and adapt it for your own personal needs!

## 📜 License
This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Project Links
GitHub Repository: https://github.com/lweber89/geocrime-stl

PyPI Home: https://pypi.org/project/geocrime-stl/
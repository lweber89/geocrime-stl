# geocrime-stl

[![Documentation Status](https://img.shields.io/badge/docs-mkdocs-blue.svg)](https://lweber89.github.io/geocrime-stl/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

A Python utility for cleaning and standardizing St. Louis Metropolitan Police Department (SLMPD) crime data for spatial analysis.

> 🗺️ **Explore the data: [St. Louis Crime Dashboard](https://lweber89.github.io/geocrime-stl/dashboard/)**: a free map, charts and hotspots for reported offenses in the City of St. Louis, updated monthly.

> 📖 **Full documentation, guides, and details have moved to the [geocrime-stl Documentation Site](https://lweber89.github.io/geocrime-stl/).**

---

## 🚀 Quick Start

### Install

    pip install geocrime-stl

### Usage

    import geocrime_stl as gc

    data_pkg = gc.run_pipeline(mm, yyyy)
    gc.generate_monthly_metrics(data_pkg)
    gc.plot_monthly_maps(data_pkg)

---

### ⚠️ Important Note & Disclaimer
This independent open-source utility fetches data directly from the SLMPD Stats Page. It is not affiliated with or endorsed by the SLMPD or the City of St. Louis.

### 🤝 Contributions
I am not accepting pull requests at this time, but feel free to open an Issue or fork the repository for your own needs.

### 📚 Additional Resources

To explore the data collected to date, please visit the [St. Louis Crime Dashboard](https://lweber89.github.io/geocrime-stl/dashboard/). It has a map you can search by address, ward or neighborhood, trend charts, and hotspots. See its [methodology page](https://lweber89.github.io/geocrime-stl/dashboard/methodology.html) for how the numbers are made and which sensitive locations are withheld.

For complete data disclaimers, ETL architecture, and local setup guides, please visit the [Documentation Site](https://lweber89.github.io/geocrime-stl/).

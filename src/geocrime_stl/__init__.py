from __future__ import annotations

from .config import CITY_BNDY, NBHD_BNDY, STL_MAP_CONFIG

# Expose the master pipeline orchestrator directly to the root namespace
from .etl.transform import run_pipeline

# Expose the monthly summary and plottin methods to the root namespace
from .insights.monthly_summary import generate_monthly_metrics, plot_monthly_maps

# Expose the utilities and exporters cleanly to the root namespace
from .utils.export import export_to_csv, export_to_geojson, export_to_gpkg

__all__ = [
    "CITY_BNDY",
    "NBHD_BNDY",
    "STL_MAP_CONFIG",
    "run_pipeline",
    "export_to_csv",
    "export_to_geojson",
    "export_to_gpkg",
    "build_web_feed",
    "plot_monthly_maps",
    "generate_monthly_metrics"
]


def __getattr__(name: str):
    """Load ``build_web_feed`` on first use. Importing it eagerly makes
    ``python -m geocrime_stl.utils.web_export`` warn that the module was already imported."""
    if name == "build_web_feed":
        from .utils.web_export import build_web_feed  # noqa: PLC0415

        return build_web_feed
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

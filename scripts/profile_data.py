"""profile_data.py: one-shot profile of the master dataset (counts, categories, times, places).

A developer tool, not part of the pipeline. Run it from anywhere:  python scripts/profile_data.py [file]
The report is printed and saved next to the data file as profile_output.txt (git-ignored).
"""
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PATH = str(sys.argv[1] if len(sys.argv) > 1 else ROOT / "data" / "processed" / "slmpd_crime_data.geojson")
OUT = Path(PATH).with_name("profile_output.txt")

lines = []
def out(*a):
    s = " ".join(str(x) for x in a)
    print(s)
    lines.append(s)

def section(name):
    out("\n=== " + name + " ===")

# ---------------------------------------------------------------- load
if PATH.lower().endswith(".csv"):
    df = pd.read_csv(PATH)
else:
    with open(PATH, encoding="utf-8") as f:
        text = f.read().strip()
    try:
        gj = json.loads(text)                   # normal case: a complete JSON document
    except json.JSONDecodeError:
        # bare list of Feature objects (one per line, trailing commas): wrap it
        gj = json.loads('{"type":"FeatureCollection","features":[' + text.rstrip(",") + "]}")

    # find the list of records, whatever the wrapper looks like
    if isinstance(gj, dict):
        print("top-level keys:", list(gj.keys())[:10])
        items = gj.get("features") or gj.get("data") or gj.get("records") or []
    else:
        items = gj
    print("items found:", len(items))
    if items:
        print("first item type:", type(items[0]).__name__)
        print("first item:", str(items[0])[:400])

    rows, skipped = [], 0
    for ft in items:
        if isinstance(ft, dict) and isinstance(ft.get("properties"), dict):
            rows.append(ft["properties"])       # normal GeoJSON feature
        elif isinstance(ft, dict) and "inc_#" in ft:
            rows.append(ft)                     # already a flat record
        else:
            skipped += 1
    if skipped:
        print("WARNING: skipped", skipped, "items with no usable properties")
    if not rows:
        raise SystemExit("No usable rows. Paste the 'first item' line above back to Claude.")
    df = pd.DataFrame(rows)

df["_t"] = pd.to_datetime(df["date_time"], errors="coerce")

# ---------------------------------------------------------------- checks
section("1. BASICS")
out(len(df), "rows")
out(df["inc_#"].nunique(), "distinct incident numbers")
out(df["_t"].isna().sum(), "rows with unparseable date_time")
out("date range:", df["_t"].min(), "to", df["_t"].max())
out("columns:", list(df.columns))

section("2. MISSING VALUES (per column)")
out(df.isna().sum().to_string())
out(((df["lat"].isna()) | (df["lon"].isna())).sum(), "rows with no coordinates")

section("3. OFFENSE TYPE")
out(df["off_type"].value_counts(dropna=False).to_string())

section("4. WHAT IS IN 'Other'")
out(df[df["off_type"] == "Other"]["nibrs_cat"].value_counts().head(15).to_string())

section("5. CATEGORIES BY TYPE (nibrs_cat, top 8 per type)")
for t, g in df.groupby("off_type"):
    out(f"-- {t}: {g['nibrs_cat'].nunique()} categories")
    out(g["nibrs_cat"].value_counts().head(8).to_string())

section("6. PER-VICTIM DUPLICATES")
cols = ["inc_#", "nibrs_code", "offense", "date_time", "address"]
dup = df.duplicated(subset=cols, keep=False)
out(dup.sum(), "rows identical on", cols)
out("by off_type:")
out(df[dup]["off_type"].value_counts().to_string())

section("7. OFFENSES PER INCIDENT")
per = df.groupby("inc_#").size()
out(per.describe().to_string())
out("incidents with 2+ offenses:", (per > 1).sum())
out("most offenses in one incident:", per.max())

section("8. TIME OF DAY")
out(round((df["_t"].dt.minute == 0).mean() * 100, 1), "% of rows exactly on the hour (expect ~1.7)")
out("rows at exactly 00:00:", ((df["_t"].dt.hour == 0) & (df["_t"].dt.minute == 0)).sum())
out("rows at exactly 12:00:", ((df["_t"].dt.hour == 12) & (df["_t"].dt.minute == 0)).sum())
out("rows by hour:")
out(df["_t"].dt.hour.value_counts().sort_index().to_string())

section("9. PLACES")
out(df["nbhd"].nunique(), "distinct neighborhoods;", df["nbhd"].isna().sum(), "missing")
out("districts:", sorted(df["district"].astype(str).unique()))
out(df["firearm"].value_counts(dropna=False).to_string())
out(df.groupby("lat").ngroups, "distinct latitudes;", df.groupby(["lat", "lon"]).ngroups, "distinct points")
out("address style: rows containing ' / ' (intersections):", df["address"].astype(str).str.contains(" / ").sum())

section("10. ROWS PER MONTH")
out(df.groupby(df["_t"].dt.to_period("M")).size().to_string())

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"\nSaved to {OUT}")

import calendar

import geopandas as gpd
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import pandas as pd

import geocrime_stl.config as config


def generate_monthly_metrics(data_pkg) -> None:
    """
    Prints a high-level statistical overview of a single month of cleaned 
    St. Louis crime data to the console.
    """

  
    # Unpack CrimeDataPackage
    df = data_pkg.df
    month_name = calendar.month_name[data_pkg.month] # Converting to full month name
    year = data_pkg.year

    print("==================================================")
    print("📊 ST. LOUIS CRIME DATA SUMMARY REPORT")
    print(f"📅 {month_name} {year}")
    print("==================================================")
    print(f"🔹 Total Incident Count: {len(df)}")
    
    # Top 5 Crime Categories (City Wide - excluding 90Z)
    print("\n🚨 TOP 5 CRIME CATEGORIES:")
    if 'nibrs_cat' in df.columns:
        top_crimes = df[df["nibrs_code"] != "90Z"]["nibrs_cat"].value_counts().head(5)
        for cat, count in top_crimes.items():
            print(f"  - {cat}: {count} incidents")
    else:
        print("  - 'nibrs_cat' column unavailable")

# District Breakdown
    print("\n⭐ INCIDENTS BY POLICE DISTRICT:")
    if 'district' in df.columns:
        districts = df['district'].value_counts().sort_index()
        for dist, count in districts.items():
            # Skip District 0 completely
            if dist == 0 or dist == '0':  
                continue
                
            print(f"  - District {dist}: {count} incidents")
    else:
        print("  - District data unavailable")
    
    # Firearm Involvement (City Wide)
    print("\n🔫 FIREARM INVOLVEMENT:")
    if 'firearm' in df.columns:
        firearm_counts = df['firearm'].value_counts()
        # Checks for common naming conventions the SLMPD uses
        yes_count = firearm_counts.get('Y', 0) + firearm_counts.get('Yes', 0)
        pct = (yes_count / len(df)) if len(df) > 0 else 0
        print(f"  - Firearm Involved: {yes_count} ({pct:.1%})")
    else:
        print("  - Firearm data unavailable")

    # Neighborhood Summary
    print("\n🏘️ NEIGHBORHOOD SUMMARY:")
    if 'nbhd' in df.columns:

        custom_order = ["Person", "Property", "Society", "Other"]

        top_3_per_offense = (
            df.groupby("off_type")["nbhd"]
            .value_counts()
            .groupby(level=0)
            .head(3)
            .reset_index(name="count")
        ).copy()

        top_3_per_offense["off_type"] = pd.Categorical(
            top_3_per_offense["off_type"], categories=custom_order, ordered=True
        )

        top_3_per_offense = top_3_per_offense.sort_values("off_type")

        for off_type, group in top_3_per_offense.groupby("off_type", observed=False):
            print(f"\nOffense Type: {off_type}")
            print("-" * 30)
            for row in group.itertuples():
                print(f"  * {row.nbhd}: {row.count} incidents")

    else:
        print("  - Neighborhood data unavailable")
                   
    print("==================================================")


def plot_monthly_maps(data_pkg) -> None:
    """
    Generates a 2x2 matplotlib quad of maps showing spatial distribution of St. Louis crime by category:
    - Top Left: All Crimes
    - Top Right: Crimes Against Person
    - Bottom Left: Crimes Against Property
    - Bottom Right: Crimes Against Society
    """
    # Method-wide Color Palette Definition
    PALETTE = {
        "all": "#6B6E70",
        "person": "#2B5C8F",
        "property": "#912A26",
        "society": "#3F7A50", 
        "bg_map": "#F2F0EA", 
        "bg_edge": "#D3CFC7" 
    }
    # Unpack CrimeDataPackage
    df = data_pkg.df
    month_name = calendar.month_name[data_pkg.month] # Converting to full month name
    year = data_pkg.year

    # Load the boundary shapefile directly
    stl_map = gpd.read_file(config.NBHD_BNDY)

    # Define the Quadrant Configurations
    quad_config = {
        (0, 0): {"filter": None, "title": "All Incidents", "color": PALETTE["all"]},
        (0, 1): {"filter": "Person", "title": "Crimes Against Persons", "color": PALETTE["person"]},
        (1, 0): {"filter": "Property", "title": "Crimes Against Property", "color": PALETTE["property"]},
        (1, 1): {"filter": "Society", "title": "Crimes Against Society", "color": PALETTE["society"]}  
    }

    # Initialize the 2x2 Subplots Frame
    fig, axs = plt.subplots(2, 2, figsize=(9.5, 16))
    fig.suptitle(f"{month_name} {year} Crime Distribution\nSt. Louis, Missouri", fontsize=18, fontweight='bold', y=0.96)

    # 5. Populate Each Quadrant
    for (row, col), cfg in quad_config.items():
        ax = axs[row, col]
        
        stl_map.plot(ax=ax, color=PALETTE["bg_map"], edgecolor=PALETTE["bg_edge"], linewidth=1.0)
        
        # Filter dataframe based on configuration
        if cfg["filter"] is None:
            filtered_df = df
        else:
            filtered_df = df[df["off_type"] == cfg["filter"]]
            
        # Plot coordinates if data exists for that quadrant
        if not filtered_df.empty and 'lon' in filtered_df.columns and 'lat' in filtered_df.columns:
            points_gdf = gpd.GeoDataFrame(
                filtered_df, 
                geometry=gpd.points_from_xy(filtered_df.lon, filtered_df.lat), 
                crs="EPSG:4326"
            )
            
            # Match alpha to legend (0.7) for consistency. 
            # Added a tiny line width/edge color trick so overlapping points maintain definition.
            points_gdf.plot(
                ax=ax, 
                color=cfg["color"], 
                markersize=6, 
                alpha=0.65,
                edgecolor='none'
            )

        # Style the sub-map

        ax.set_title(f"{cfg['title']} (n={len(filtered_df)})", fontsize=12, fontweight='semibold', pad=8)
        ax.set_axis_off()

    # Build a unified legend using the PALETTE
    city_patch = mpatches.Patch(facecolor=PALETTE["bg_map"], edgecolor=PALETTE["bg_edge"], label="STL Neighborhood Boundaries")
    all_patch = mpatches.Patch(color=PALETTE["all"], alpha=0.9, label="All Crimes")
    person_patch = mpatches.Patch(color=PALETTE["person"], alpha=0.9, label="Person")
    property_patch = mpatches.Patch(color=PALETTE["property"], alpha=0.9, label="Property")
    society_patch = mpatches.Patch(color=PALETTE["society"], alpha=0.9, label="Society")

    fig.legend(
        handles=[city_patch, all_patch, person_patch, property_patch, society_patch],
        loc="lower center", 
        ncol=5, 
        fontsize=11,
        bbox_to_anchor=(0.5, 0.04)
    )

    plt.subplots_adjust(
    left=0.02,     
    right=0.98,    
    top=0.88,      
    bottom=0.10,   
    wspace=0.00,   
    hspace=0.08    
)
    plt.show()
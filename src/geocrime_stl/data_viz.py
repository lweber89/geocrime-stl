import leafmap.deck as lmd  # Pydeck backend
import pydeck as pdk

from geocrime_stl.config import STL_MAP_CONFIG


def hexbin_3D_maps(data_pkg, crime_category="Person"):
    df = data_pkg.df

    # Define the 4 distinct color schemes (Light-to-Dark Sequential Palettes)
    COLOR_PALETTES = {
        "Person":   [[222, 235, 247], [158, 202, 225], [66, 146, 198], [33, 113, 181], [8, 48, 107]],  # Blue
        "Property": [[251, 224, 244], [241, 145, 219], [221, 52, 171], [166, 3, 111], [74, 1, 49]],   # Magenta
        "Society":  [[229, 245, 224], [161, 217, 155], [116, 196, 118], [49, 163, 84], [0, 90, 50]],   # Green
        "Other":    [[240, 240, 240], [189, 189, 189], [150, 150, 150], [115, 115, 115], [37, 37, 37]]   # Gray
    }

    # Dynamic map settings tailored to specific category point densities
    MAP_CONFIGS = {
        "All":      {"radius": 200, "elevation_scale": 15, "coverage": 0.90},
        "Property": {"radius": 200, "elevation_scale": 18, "coverage": 0.90},
        "Person":   {"radius": 350, "elevation_scale": 45, "coverage": 0.95}, 
        "Society":  {"radius": 300, "elevation_scale": 40, "coverage": 0.95}, 
        "Other":    {"radius": 250, "elevation_scale": 25, "coverage": 0.90}
    }

    # Pull structural config values dynamically based on choice
    config = MAP_CONFIGS.get(crime_category, MAP_CONFIGS["All"])

    # Apply categorical data filters and assign chosen color theme
    if crime_category == "All":
        filtered_df = df.copy()
        # Custom multicolor palette for the combined dataset
        active_palette = [[65, 182, 196], [127, 205, 187], [253, 141, 60], [189, 0, 38]]
    else:
        filtered_df = df[df['off_type'] == crime_category].copy()
        active_palette = COLOR_PALETTES.get(crime_category, COLOR_PALETTES["Other"])

    # Handle case where filtered data might be empty
    if filtered_df.empty:
        filtered_df = df.copy() # fallback so pydeck doesn't crash on initialization

    # Add a dedicated weight column to the dataframe for pydeck aggregation stability
    filtered_df["count_weight"] = 1

    # The 3D Density Hexagon Topography
    hex_layer = pdk.Layer(
        "HexagonLayer",
        data=filtered_df,
        get_position=["lon", "lat"],
        get_weight="count_weight",     
        aggregation="SUM",  
        radius=config["radius"],                   
        extruded=True,                 
        elevation_scale=config["elevation_scale"], 
        elevation_range=[0, 300],      
        coverage=config["coverage"],               
        color_range=active_palette     
    )

    # Central perspective camera coordinates
    view_state = pdk.ViewState(
        latitude=STL_MAP_CONFIG[0][0],
        longitude=STL_MAP_CONFIG[0][1],
        zoom=11.5,                   
        pitch=50,                      
        bearing=10                     
    )

    # Render inside leafmap.deckmap wrapper
    # SWAPPED map_style to dark-matter-gl-style to make the hexagons pop elegantly
    m = lmd.Map(
        height=850,  
        initial_view_state=view_state,
        layers=[hex_layer], 
        map_style="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    )

    return m

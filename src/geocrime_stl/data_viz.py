import folium
import leafmap.deck as lmd  # Pydeck backend
import leafmap.foliumap as lmf  # Folium backend
import pydeck as pdk

from geocrime_stl.config import STL_MAP_CONFIG

HOTSPOT_RADIUS = 25
HOTSPOT_BLUR = 15

def hotspot_maps(data_package, crime_category="Person", radius=HOTSPOT_RADIUS, blur=HOTSPOT_BLUR):
    """
    Generates an interactive leafmap (folium backend) object 
    displaying a specific crime category hotspot, fully compatible with Streamlit.
    """
    df = data_package.df
    
    # 1. Start with your working map framework
    m = lmf.Map(
        center=STL_MAP_CONFIG[0],
        zoom=STL_MAP_CONFIG[1],
        height=STL_MAP_CONFIG[2]
    )
    
    # 2. Add raw Folium GeoJson (Indented properly inside the function)
    folium.GeoJson(
        "data/stl_neighborhoods.geojson",
        style_function=lambda x: {
            "color": "#7a8a99",
            "weight": 0.7,
            "opacity": 0.35,
            "fillOpacity": 0
        }
    ).add_to(m)

    # 3. Filter DataFrame safely
    filtered_df = df[df["off_type"].astype(str).str.lower().str.contains(crime_category.lower(), na=False)].copy()
    
    # If empty, apply your working basemap override and exit
    if filtered_df.empty:
        m.add_basemap("CartoDB.DarkMatter")
        return m  
        
    # 4. Set up gradients
    if crime_category == "Person":
        gradient_config = {0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1.0: "red"}
    elif crime_category == "Property":
        gradient_config = {0.4: "purple", 0.6: "magenta", 0.8: "orange", 1.0: "yellow"}
    else:
        gradient_config = {0.4: "green", 0.6: "lime", 0.8: "teal", 1.0: "blue"}

    # Hand-jammed numeric column to keep leafmap stable
    filtered_df["heatmap_weight"] = 1

    # 5. Add the heatmap data (disable auto-zooming)
    m.add_heatmap(
        data=filtered_df,
        latitude="lat",
        longitude="lon",
        value="heatmap_weight",
        radius=radius,       
        blur=blur,          
        gradient=gradient_config,
        fit_bounds=False  
    )
    
    # 6. Your working ultimate basemap override
    m.add_basemap("CartoDB.DarkMatter")
    
    # 7. Zoom window lock down
    center_lat, center_lon = STL_MAP_CONFIG[0]
    buffer = 0.09  
    
    m.fit_bounds([
        [center_lat - buffer, center_lon - buffer], # Southwest corner
        [center_lat + buffer, center_lon + buffer]  # Northeast corner
    ])
    
    return m


def hexbin_maps(data_pkg, crime_category="Person"):
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

def plot_all_crimes(data_package):
    df = data_package.df

    m = lmf.Map(
        center=STL_MAP_CONFIG[0],
        zoom=STL_MAP_CONFIG[1],
        height=STL_MAP_CONFIG[2],
        basemap="CartoDB.Positron",
    )

    # Map the crime types to standard FontAwesome icon names and colors
    icon_mapping = {
        'Person': {'icon': 'user', 'color': 'red'},
        'Property': {'icon': 'home', 'color': 'blue'},
        'Society': {'icon': 'shield', 'color': 'green'},
        'Other': {'icon': 'gavel', 'color': 'purple'}
    }

    # FIX 4: Use leafmap's native add_points_from_xy which natively creates
    # lightning-fast marker clusters, custom popups, and custom icons.
    
    # We create a column for custom HTML text to pass straight into the popups
    df['popup_text'] = df.apply(lambda row: f"""
        <div style="font-family: sans-serif; min-width: 200px;">
            <h4>Incident #{row['inc_#']}</h4>
            <hr style="border: 0; border-top: 1px solid #ccc; margin: 5px 0;">
            <b>Offense:</b> {row['offense']}<br>
            <b>Date/Time:</b> {row['date_time']}<br>
            <b>Location:</b> {row['address']}
        </div>
    """, axis=1)

    # Drop data onto the map using leafmap's optimized marker engine
    m.add_points_from_xy(
        df,
        x="lon",
        y="lat",
        popup=["popup_text"],
        clustering=True, # Automatically clusters your points!
        icon_names=[icon_mapping.get(t, {'icon': 'gavel'})['icon'] for t in df['off_type']],
        icon_colors=[icon_mapping.get(t, {'color': 'purple'})['color'] for t in df['off_type']],
        icon_prefixes=['fa'] * len(df)
    )

    return m
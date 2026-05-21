import calendar
import leafmap
from ipyleaflet import Heatmap

HOTSPOT_RADIUS = 30
HOTSPOT_BLUR = 15

def hotspot_maps(data_package, crime_category="Person"):
    """
    Generates an interactive leafmap (ipyleaflet) object 
    displaying a specific crime category hotspot.
    """
    df = data_package.df
    
    # Base map initialization
    stl_center = [38.6282, -90.2476]
    m = leafmap.Map(
        center=stl_center,
        zoom=12,
        height="800px",
        basemap="CartoDB.DarkMatter",
        layer_control=False,
        draw_control=False,
        fullscreen_control=False,
        toolbar_control=False
    )
    
    # Define neighborhood line style
    neighborhood_style = {
        "color": "#7a8a99",
        "weight": 0.6,
        "opacity": 0.35,
        "fillOpacity": 0
    }
    
    #Pass style via lambda function to comply with ipyleaflet backend requirements
    m.add_geojson(
        "data/stl_neighborhoods.geojson", 
        style_callback=lambda feature: neighborhood_style,
        hover_style=neighborhood_style, 
        info_mode=None
    )

    # 2. Filter down to chosen category
    filtered_df = df[df["off_type"].str.lower().str.contains(crime_category.lower(), na=False)].copy()

    df["off_type"].head()
    
    if filtered_df.empty:
        return m  # Returns base map with background borders if data frame is empty
        
    filtered_df["intensity"] = 1

    locations_list = filtered_df[["lat", "lon", "intensity"]].values.tolist()

    # 3. Determine custom gradients dynamically 
    if crime_category == "Person":
        gradient_config = {0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1.0: "red"}
    elif crime_category == "Property":
        gradient_config = {0.4: "purple", 0.6: "magenta", 0.8: "orange", 1.0: "yellow"}
    else:  # Society
        gradient_config = {0.4: "green", 0.6: "lime", 0.8: "teal", 1.0: "blue"}

    # 4. Generate and attach the heatmap layer
    heatmap_layer = Heatmap(
        locations=locations_list,
        name=crime_category,
        radius=HOTSPOT_RADIUS,
        blur=HOTSPOT_BLUR,
        gradient=gradient_config
    )
    
    m.add_layer(heatmap_layer)
    return m
import leafmap
from ipyleaflet import Heatmap
from ipyleaflet import Marker, MarkerCluster, AwesomeIcon
from ipywidgets import HTML
from geocrime_stl.constants import STL_MAP_CONFIG
    

HOTSPOT_RADIUS = 30
HOTSPOT_BLUR = 15

def hotspot_maps(data_package, crime_category="Person", radius = HOTSPOT_RADIUS, blur = HOTSPOT_BLUR):
    """
    Generates an interactive leafmap (ipyleaflet) object 
    displaying a specific crime category hotspot.
    """
    df = data_package.df
    
    # Base map initialization

    m = leafmap.Map(
        center=STL_MAP_CONFIG[0],
        zoom=STL_MAP_CONFIG[1],
        height=STL_MAP_CONFIG[2],
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
    
    # Pass style via lambda function to comply with ipyleaflet backend requirements
    m.add_geojson(
        "data/stl_neighborhoods.geojson", 
        style_callback=lambda feature: neighborhood_style,
        hover_style=neighborhood_style, 
        info_mode=None
    )

    # Filter down to chosen category
    filtered_df = df[df["off_type"].str.lower().str.contains(crime_category.lower(), na=False)].copy()
    
    if filtered_df.empty:
        return m  # Returns base map with background borders if data frame is empty
        
    filtered_df["intensity"] = 1

    locations_list = filtered_df[["lat", "lon", "intensity"]].values.tolist()

    # Determine custom gradients dynamically 
    if crime_category == "Person":
        gradient_config = {0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1.0: "red"}
    elif crime_category == "Property":
        gradient_config = {0.4: "purple", 0.6: "magenta", 0.8: "orange", 1.0: "yellow"}
    else:  # Society
        gradient_config = {0.4: "green", 0.6: "lime", 0.8: "teal", 1.0: "blue"}

    # Generate and attach the heatmap layer
    heatmap_layer = Heatmap(
        locations=locations_list,
        name=crime_category,
        radius=HOTSPOT_RADIUS,
        blur=HOTSPOT_BLUR,
        gradient=gradient_config
    )
    
    m.add_layer(heatmap_layer)
    return m


def plot_all_crimes(data_package):


    df = data_package.df

    m = leafmap.Map(
        center=STL_MAP_CONFIG[0],
        zoom=STL_MAP_CONFIG[1],
        height=STL_MAP_CONFIG[2],
        basemap="CartoDB.Positron",
    )

    # Icons setup
    icon_persons = AwesomeIcon(name='user', marker_color='red', icon_color='white', prefix='fa')
    icon_property = AwesomeIcon(name='home', marker_color='blue', icon_color='white', prefix='fa')
    icon_society = AwesomeIcon(name='shield', marker_color='green', icon_color='white', prefix='fa')
    icon_other = AwesomeIcon(name='gavel', marker_color='purple', icon_color='white', prefix='fa')

    icon_mapping = {
        'Person': icon_persons,
        'Property': icon_property,
        'Society': icon_society,
        'Other': icon_other
    }

    # Expand the list comprehension to generate tooltips and popups dynamically
    markers = []
    for _, row in df.iterrows():
        
        # CLICK TEXT: Rich HTML layout for clean structure
        click_html = HTML(value=f"""
            <div style="font-family: sans-serif; min-width: 200px;">
                <h4 style="margin: 0 0 5px 0; color: #333;">Incident #{row['inc_#']}</h4>
                <hr style="border: 0; border-top: 1px solid #ccc; margin: 5px 0;">
                <b>Offense:</b> {row['offense']}<br>
                <b>Date/Time:</b> {row['date_time']}<br>
                <b>Location:</b> {row['address']}
            </div>
        """)
        
        # Create the marker with all its interactive layers
        marker = Marker(
            location=[row["lat"], row["lon"]], 
            icon=icon_mapping.get(row["off_type"], icon_other),
            popup=click_html
        )
        markers.append(marker)

    # Bundle into the cluster and add to map
    marker_cluster = MarkerCluster(markers=markers, name="All NIBRS Incidents")
    m.add_layer(marker_cluster)

    return m
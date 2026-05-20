import calendar
import leafmap
from ipywidgets import Dropdown
from ipyleaflet import WidgetControl, Heatmap

HOTSPOT_RADIUS = 30
HOTSPOT_BLUR = 15

def hotspot_maps(data_package):
    """
    Generates an interactive leafmap object with dropdown filtering 
    for Persons, Property, and Society crime hotspots.
    """
    df = data_package.df
    
    map_label = f"{calendar.month_name[data_package.month]} {data_package.year}"

    # 1. Filter and copy your dataframes
    persons_df = df[df["off_type"].str.lower().str.contains("person", na=False)].copy()
    property_df = df[df["off_type"].str.lower().str.contains("property", na=False)].copy()
    society_df = df[df["off_type"].str.lower().str.contains("society", na=False)].copy()

    persons_df["intensity"] = 1
    property_df["intensity"] = 1
    society_df["intensity"] = 1

    # 2. Initialize the map base


    # 3. Store the [latitude, longitude] center in your variable
    stl_center = [38.62827082238057, -90.24760264969585]

    m = leafmap.Map(
        center=stl_center,
        zoom=12,
        height = "800px",
        basemap="CartoDB.DarkMatter",
        layer_control=False,
        draw_control=False,
        fullscreen_control=False,
        toolbar_control=False
    )

    # 3. Inner Helper Functions (Nested functions must be indented an extra 4 spaces!)
    def get_person_layer():
        if persons_df.empty: return None
        return Heatmap(
            locations=persons_df[["lat", "lon", "intensity"]].values.tolist(),
            name="Persons", radius=HOTSPOT_RADIUS, blur = HOTSPOT_BLUR,
            gradient={0.4: "blue", 0.6: "cyan", 0.7: "lime", 0.8: "yellow", 1.0: "red"}
        )

    def get_property_layer():
        if property_df.empty: return None
        return Heatmap(
            locations=property_df[["lat", "lon", "intensity"]].values.tolist(),
            name="Property", radius=HOTSPOT_RADIUS, blur = HOTSPOT_BLUR,
            gradient={0.4: "purple", 0.6: "magenta", 0.8: "orange", 1.0: "yellow"}
        )

    def get_society_layer():
        if society_df.empty: return None
        return Heatmap(
            locations=society_df[["lat", "lon", "intensity"]].values.tolist(),
            name="Society", radius=HOTSPOT_RADIUS, blur = HOTSPOT_BLUR,
            gradient={0.4: "green", 0.6: "lime", 0.8: "teal", 1.0: "blue"}
        )

    generator_mapping = {
        "Persons": get_person_layer,
        "Property": get_property_layer,
        "Society": get_society_layer
    }

    # 4. Setup Dropdown & Update Logic
    dropdown = Dropdown(
        options=[k for k, v in generator_mapping.items()],
        value="Persons",
        description= map_label + " Hotspots:",
        style={'description_width': 'initial'}
    )

    m.current_crime_layer = None

    def update_map_layer(chosen_label):
        if m.current_crime_layer is not None:
            m.remove_layer(m.current_crime_layer)
            m.current_crime_layer = None
            
        layer_generator = generator_mapping.get(chosen_label)
        if layer_generator is not None:
            fresh_layer = layer_generator()
            if fresh_layer is not None:
                neighborhood_style = {
                    "color": "#7a8a99",
                    "weight": 0.6,
                    "opacity": 0.35,
                    "fillOpacity": 0
                }
                m.add_geojson("data/neighborhoods.geojson", style=neighborhood_style, hover_style=neighborhood_style, info_mode=None)
                m.add_layer(fresh_layer)
                m.current_crime_layer = fresh_layer

    def on_dropdown_change(change):
        if change['type'] == 'change' and change['name'] == 'value':
            update_map_layer(change['new'])

    dropdown.observe(on_dropdown_change)

    dropdown_control = WidgetControl(widget=dropdown, position='topright')
    m.add_control(dropdown_control)

    # 5. Trigger initial map render
    update_map_layer(dropdown.value)

    # 6. CRITICAL STEP: Return the map object back to the user
    return m
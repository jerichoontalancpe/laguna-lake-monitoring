# Laguna Lake Water Quality Monitoring Portal

A single-page web application for monitoring and visualizing water quality data across five LLDA stations on Laguna de Bay (Laguna Lake), Philippines. Built with Leaflet.js for interactive mapping, Chart.js for trend visualization, and Tailwind CSS for a responsive dashboard layout.

Parameter thresholds follow **DENR DAO 2016-08 Class C** standards for fisheries, recreation, and general-purpose waters.

## Data Methodology

The water quality values in this portal are **representative sample data** modeled after documented conditions in Laguna de Bay. They are **not live sensor readings**. Station coordinates and bay designations are based on LLDA monitoring station references. Trend data covers a simulated six-month period (June–November) to illustrate typical seasonal variation patterns. The lake boundary polygon is derived from **OpenStreetMap** (relation 79348).

This project is built for educational and academic purposes under WITM 101 Advanced Web Design and Programming.

---

## Layout

```
+------------------------------------------------------------------+
|  HEADER: Title  |  Dynamic Status Counts  |  Last Updated Date  |
+--------------------------------------+---------------------------+
|                                      | SIDEBAR (initial load):   |
|   INTERACTIVE MAP (Leaflet.js)       |   Lake-wide overview      |
|                                      |   - Good/Fair/Poor counts |
|   - Real Laguna de Bay boundary      |   - Avg DO, BOD, pH, Temp |
|   - Color-coded station markers      |   - Clickable station list|
|   - Filter dropdown (top-left)       |                           |
|   - Floating legend (bottom-left)    | SIDEBAR (station selected)|
|   - Scale bar (bottom-right)         |   - Station name & bay    |
|   - Zoom controls (top-right)        |   - Status badge          |
|                                      |   - 6 parameter cards     |
|                                      |   - 6-month trend chart   |
+--------------------------------------+---------------------------+
```

On mobile, the map takes the full screen and the sidebar slides up as a bottom sheet when a station marker is tapped.

---

## Features

- Interactive Leaflet map centered on Laguna de Bay with panning restricted to the lake/Rizal region
- Real lake boundary polygon from OpenStreetMap (761 points, simplified from 11,390)
- Color-coded circular markers by overall water quality status (Good / Fair / Poor)
- Proportional bubble markers when filtering by individual parameter
- Dynamic header showing real-time Good/Fair/Poor counts from loaded data
- Lake-wide overview sidebar on initial load with average parameter values and clickable station list
- Station detail sidebar on marker click with all 6 parameter cards and progress bars
- Progress bars with threshold markers and direction hints (higher is better / lower is better)
- 6-month historical trend chart (Chart.js) with toggleable datasets for all 6 parameters
- Dashed threshold reference lines on the trend chart at DAO 2016-08 limits
- Parameter filter dropdown to switch map display between overall status and individual parameters
- Floating legend that updates to explain bubble sizes when in parameter filter mode
- Scale bar in metric units (bottom-right of map)
- Responsive layout: desktop split view, mobile bottom sheet
- Async data loading with ES module imports and proper error handling

---

## Tech Stack

| Component          | Tool                           |
|--------------------|--------------------------------|
| Mapping Engine     | Leaflet.js 1.9.4               |
| Map Base Layer     | OpenStreetMap (no API key)     |
| Data Visualization | Chart.js 4.4.1                 |
| Front-End Styling  | Tailwind CSS (CDN)             |
| Data Format        | GeoJSON (stations + boundary)  |
| JavaScript         | ES Modules (import/export)     |

No build tools, no API keys, no backend required.

---

## Project Structure

```
laguna-lake-monitoring/
├── index.html              # Single-page HTML entry point
├── README.md
├── assets/
│   ├── stations.json       # GeoJSON: 5 monitoring stations, 6 parameters, 6-month trends
│   └── lake-boundary.json  # GeoJSON: Real Laguna de Bay shoreline (OpenStreetMap)
├── css/
│   └── style.css           # Custom styles: markers, sidebar, parameter bars, responsive
└── js/
    ├── data.js             # PARAMETERS config, threshold evaluation, GeoJSON loaders (exports)
    ├── charts.js           # Chart.js trend chart, parameter bars, toggle buttons (imports data.js)
    └── map.js              # Leaflet init, markers, filters, legend, sidebar (imports both)
```

---

## Setup

The app uses `fetch()` to load GeoJSON files and must be served through a local web server. Opening `index.html` directly with `file://` will fail due to CORS restrictions.

### Option 1: Python (recommended)

```bash
cd laguna-lake-monitoring
python3 -m http.server 8080
```

Open `http://127.0.0.1:8080` in your browser.

### Option 2: Node.js

```bash
cd laguna-lake-monitoring
npx serve -l 8080
```

### Option 3: VS Code Live Server extension

Right-click `index.html` and select "Open with Live Server".

---

## Usage

1. The map loads with all five stations visible and the sidebar showing a lake-wide summary.
2. **Click a station marker** to see full details: status badge, all 6 parameter cards with progress bars, and a 6-month trend chart.
3. **Toggle trend parameters** using the colored pills above the chart. All 6 parameters (DO, BOD, COD, Turbidity, pH, Temperature) are toggleable.
4. **Use the filter dropdown** (top-left) to switch from overall status to a single parameter view. Markers become proportional bubbles and the legend updates to explain the bubble size.
5. On **mobile**, tap a marker to slide up the bottom sheet with station details.
6. **Click a station name** in the initial lake-wide overview to jump to that station on the map.

---

## Monitoring Stations

| Station      | Bay                          | Coordinates (lng, lat) | Status |
|--------------|------------------------------|-------------------------|--------|
| Station I    | Central Bay                  | 121.246, 14.332         | Good   |
| Station II   | East Bay                     | 121.325, 14.3725        | Fair   |
| Station IV   | West Bay                     | 121.127, 14.418         | Fair   |
| Station V    | Northern West Bay (Napindan) | 121.102, 14.526         | Poor   |
| Station VIII | South Bay                    | 121.258, 14.238         | Good   |

All station coordinates are verified to fall within the real Laguna de Bay polygon boundary.

---

## Water Quality Parameters and Thresholds

All thresholds follow **DENR DAO 2016-08 Class C** (waters intended for fisheries, recreation, and general purpose).

| Parameter                       | Key           | Unit  | Threshold    | Direction          |
|---------------------------------|---------------|-------|--------------|--------------------|
| Dissolved Oxygen (DO)           | `do`          | mg/L  | >= 5.0       | Higher is better   |
| pH Level                        | `ph`          | —     | 6.5 – 9.0    | Acceptable range   |
| Biochemical Oxygen Demand (BOD) | `bod`         | mg/L  | <= 7.0       | Lower is better    |
| Chemical Oxygen Demand (COD)    | `cod`         | mg/L  | <= 25.0      | Lower is better    |
| Turbidity                       | `turbidity`   | NTU   | <= 80.0      | Lower is better    |
| Temperature                     | `temperature` | °C    | 25.0 – 31.0  | Acceptable range   |

### Status Evaluation

| Status | Criteria                                              |
|--------|-------------------------------------------------------|
| Pass   | Value is within the acceptable threshold              |
| Alert  | Value is borderline (near the threshold boundary)     |
| Fail   | Value exceeds the allowable limit                     |

Overall station status:

| Status | Criteria                                           |
|--------|----------------------------------------------------|
| Good   | All parameters pass                                |
| Fair   | 1–2 parameters at alert level, or one at fail      |
| Poor   | 2+ parameters at fail, or 3+ at alert level        |

---

## References

References follow APA 7th edition format.

- Agafonkin, V. (2023). *Leaflet* (Version 1.9.4) [Computer software]. https://leafletjs.com
- Andersson, R. (n.d.). *Inter* [Typeface]. Google Fonts. https://fonts.google.com/specimen/Inter
- Chart.js Contributors. (2023). *Chart.js* (Version 4.4.1) [Computer software]. https://www.chartjs.org
- Department of Environment and Natural Resources. (2016). *Water quality guidelines and general effluent standards of 2016* (DENR Administrative Order No. 2016-08). Environmental Management Bureau.
- Esri. (n.d.). *World Imagery* [Basemap]. ArcGIS Online. https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer
- Laguna Lake Development Authority. (n.d.). *Research programs*. Retrieved November 24, 2026, from https://llda.gov.ph/research-programs/
- Laguna Lake Development Authority. (2026). *Water quality report: Second quarter 2026 (April–June 2026)* [Report].
- Lucide Contributors. (n.d.). *Lucide* [Computer software]. https://lucide.dev
- OpenStreetMap contributors. (n.d.). *Laguna de Bay* [Relation 79348]. OpenStreetMap. Retrieved November 24, 2026, from https://www.openstreetmap.org/relation/79348
- Saadeghi, P. (2025). *daisyUI* (Version 5) [Computer software]. https://daisyui.com

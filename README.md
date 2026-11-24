# Laguna Lake Water Quality Monitoring Portal

A multi-page web application that maps and visualizes water quality at the Laguna Lake Development Authority (LLDA) lake monitoring stations on Laguna de Bay, Philippines. Readings come from the **LLDA Q2 2026 Quarterly Water Quality Monitoring Report (April–June 2026)** and are evaluated against DENR Class C water quality guidelines.

**Live site:** https://jerichoontalancpe.github.io/laguna-lake-monitoring/
**Repository:** https://github.com/jerichoontalancpe/laguna-lake-monitoring

Built for WITM 101 — Advanced Web Design and Programming (Final Examination).

## Data Methodology

- **Source:** LLDA Q2 2026 Quarterly Water Quality Monitoring Report, Environmental Laboratory and Research Division. The report is included at `assets/2Q2026 WATER QUALITY REPORT.pdf`; its values were transcribed into `llda_q2_2026_water_quality.json` and converted into `assets/stations.json`.
- **Stations:** 16 active lake stations sampled in Q2 2026, plus 3 archived stations (III, VI, VII) that are not in the report. Archived stations have no readings and are shown for historical reference only.
- **Readings:** the map, status and tables use the **June 2026** reading. Trend charts plot the **April, May and June 2026** monthly readings.
- **Below detection:** values reported as `<0.1` are shown as reported and plotted at 0.1.
- **Coordinates:** the report gives station names but not coordinates, so markers are approximate positions inside each named bay.
- **Lake boundary:** OpenStreetMap relation 79348, simplified from 11,390 to 761 points.
- **Not included:** the report's 37 tributary river stations, because the report has no coordinates for them.

## Pages

| Page | What it shows |
|---|---|
| `index.html` Dashboard | Photo slideshow hero, animated stat counters, status summary boxes, Class C benchmark cards with lake-wide averages and how many stations meet each limit, link to the source PDF |
| `map.html` Live Map | Leaflet map with Street and Satellite layers, lake boundary, 19 color-coded markers, parameter filter (bubble markers), lake-wide overview, station detail panel with parameter bars, additional parameters and an April–June trend chart |
| `stations.html` Stations | Sortable table of all 16 active stations, station cards, an Archived tab, and a details window with charts |
| `about.html` About | LLDA monitoring network, DENR standards, parameter reference cards, status rules, data methodology, technology stack, APA 7 references |

## Water Quality Parameters and Thresholds

Laguna de Bay is a Class C water body. Each reading is compared with the DENR Class C guideline, using the same color bands as the LLDA report.

| Parameter | Unit | Class C (Pass) | Class D (Alert) | Fail | Limit source |
|---|---|---|---|---|---|
| Dissolved Oxygen (DO) | mg/L | ≥ 5 | > 2 to < 5 | ≤ 2 | DAO 2016-08 |
| Biochemical Oxygen Demand (BOD) | mg/L | ≤ 7 | > 7 to 15 | > 15 | DAO 2016-08 |
| pH | — | 6.5 – 9.0 | 6.0 – 9.0 | < 6.0 or > 9.0 | DAO 2016-08 |
| Nitrate | mg/L | ≤ 7 | > 7 to 15 | > 15 | DAO 2016-08 |
| Phosphate | mg/L | ≤ 0.025 | > 0.025 to 0.05 | > 0.05 | DAO 2021-19 |
| Total Suspended Solids (TSS) | mg/L | ≤ 80 | > 80 to 110 | > 110 | DAO 2016-08 |
| Ammonia (additional) | mg/L | ≤ 0.06 | > 0.06 to 0.3 | > 0.3 | DAO 2021-19 |
| Chloride (additional) | mg/L | ≤ 350 | > 350 to 400 | > 400 | DAO 2016-08 |
| Fecal Coliform (additional) | MPN/100mL | ≤ 200 | > 200 to 400 | > 400 | DAO 2021-19 |

The six core parameters appear on the map filter, charts and table. The three additional parameters appear in station details. All nine count toward the overall status:

| Overall status | Rule |
|---|---|
| Good | Every parameter meets Class C |
| Fair | Exactly one parameter is outside Class C |
| Poor | Two or more parameters are outside Class C |

**June 2026 result:** 12 stations Fair and 4 Poor (I, XIII, XX, XXIV). No station is Good, because phosphate exceeds the Class C limit at all 16 stations (0.14–0.57 mg/L against a 0.025 mg/L limit).

## Monitoring Stations

| Station | Report name | Bay | Status in portal |
|---|---|---|---|
| Station I | Central West Bay | Central West Bay | Active |
| Station II | East Bay | East Bay | Active |
| Station IV | Central Bay | Central Bay | Active |
| Station V | Northern West Bay | Northern West Bay | Active |
| Station VIII | South Bay | South Bay | Active |
| Station XIII | Taytay | West Bay (Taytay) | Active |
| Station XV | San Pedro (West Bay) | West Bay (San Pedro) | Active |
| Station XVI | Sta Rosa (West Bay) | West Bay (Sta. Rosa) | Active |
| Station XVII | Fish Sanctuary (Central Bay) | Central Bay | Active |
| Station XVIII | Pagsanjan (East Bay) | East Bay (Pagsanjan) | Active |
| Station XIX | Muntinlupa | West Bay (Muntinlupa) | Active |
| Station XX | GEMS | Central/West Bay (GEMS) | Active |
| Station XXI | Cardona (Talim) | Central Bay (Cardona) | Active |
| Station XXII | Jala-jala | South/Central Bay | Active |
| Station XXIII | Lumban | East Bay (Lumban) | Active |
| Station XXIV | Cardona (North Central Bay) | North Central Bay (Cardona) | Active |
| Station III | West Bay | West Bay | Archived |
| Station VI | West Bay | West Bay | Archived |
| Station VII | East Bay | East Bay | Archived |

## Tech Stack

| Component | Tool |
|---|---|
| Mapping | Leaflet.js 1.9.4, OpenStreetMap tiles, Esri World Imagery |
| Charts | Chart.js 4.4.1 (dual Y-axis, custom threshold-line plugin) |
| UI | daisyUI 5 on Tailwind CSS 4 (CDN), Lucide icons, Inter font |
| Data | GeoJSON (`stations.json`, `lake-boundary.json`) loaded with `fetch()` |
| JavaScript | ES modules (`data.js` → `charts.js` → `map.js`), no build step |
| Hosting | GitHub Pages |

## Project Structure

```
laguna-lake-monitoring/
├── index.html, map.html, stations.html, about.html
├── css/style.css
├── js/
│   ├── data.js     # parameter limits, Pass/Alert/Fail logic, data loading and validation
│   ├── charts.js   # trend charts, parameter bars, additional-parameter table
│   └── map.js      # Leaflet map, markers, sidebar, station details
├── assets/
│   ├── stations.json             # 16 active + 3 archived stations (Q2 2026 readings)
│   ├── lake-boundary.json        # Laguna de Bay polygon (OpenStreetMap)
│   ├── 2Q2026 WATER QUALITY REPORT.pdf
│   └── images (logo, hero photos, background pattern)
└── llda_q2_2026_water_quality.json   # transcribed report data (source for stations.json)
```

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

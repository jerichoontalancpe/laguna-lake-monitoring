/**
 * map.js — Leaflet map, markers, sidebar, and station modal
 * for the redesigned multi-page LLDA Water Quality Portal (map.html).
 */

import {
  PARAMETERS,
  getParameterStatus,
  geoJSONToLatLng,
  getStatusColor,
  getStatusClass,
  getThresholdText,
  displayValue,
  loadStations,
  loadLakeBoundary
} from "./data.js";
import {
  renderParameterBars,
  renderExtraParameters,
  initTrendChart,
  updateTrendChart,
  renderTrendToggles,
  setCurrentStation
} from "./charts.js";

// ── State ─────────────────────────────────────
let map = null;
let stationMarkers = [];
let stationData = null;
let stationMetadata = null;
let selectedMarker = null;
let currentFilter = "overall";

// daisyUI color names per status
const DAISY_COLOR = { Good: "success", Fair: "warning", Poor: "error" };
const STATUS_ICON  = { Good: "check-circle", Fair: "alert-triangle", Poor: "x-circle" };

// ── Map init ──────────────────────────────────
function initMap() {
  map = L.map("map", {
    center: [14.35, 121.25],
    zoom: 11,
    minZoom: 2,
    maxZoom: 19,
    zoomControl: true,
    attributionControl: true
  });

  // No bounds restriction — users can pan freely like a real portal

  const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 19
  });

  const satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, USGS, AGA, GeoEye",
    maxZoom: 19
  });

  streetLayer.addTo(map);

  L.control.layers(
    { "Street": streetLayer, "Satellite": satelliteLayer },
    {},
    { position: "topright" }
  ).addTo(map);

  map.zoomControl.setPosition("topright");

  L.control.scale({ position: "bottomright", metric: true, imperial: false, maxWidth: 120 }).addTo(map);
}

// ── Lake boundary ─────────────────────────────
function renderLakeBoundary(geojson) {
  const layer = L.geoJSON(geojson, {
    style: {
      color: "#1d6f42",
      weight: 3,
      opacity: 1,
      fillColor: "#38bdf8",
      fillOpacity: 0.08,
      dashArray: null
    }
  }).addTo(map);
  map.fitBounds(layer.getBounds(), { padding: [40, 40] });
}

// ── Markers ───────────────────────────────────
function createMarker(feature, filterMode) {
  const props = feature.properties;
  const latLng = geoJSONToLatLng(feature.geometry.coordinates);

  let iconHtml, iconSize;

  if (filterMode === "overall") {
    const label = props.name.replace("Station ", "");
    if (props.archived) {
      iconHtml = `<div class="wq-marker wq-marker-archived" data-id="${props.id}" title="${props.name} — Archived">
        <span class="wq-marker-label">${label}</span></div>`;
    } else {
      const sc = getStatusClass(props.overallStatus);
      iconHtml = `<div class="wq-marker wq-marker-${sc}" data-id="${props.id}">
        <span class="wq-marker-label">${label}</span></div>`;
    }
    iconSize = [32, 32];
  } else {
    const pd = props.parameters[filterMode];
    const pc = PARAMETERS[filterMode];
    if (!pd || !pc) {
      const sc = props.archived ? "archived" : getStatusClass(props.overallStatus);
      iconHtml = `<div class="wq-marker wq-marker-${sc}" data-id="${props.id}">
        <span class="wq-marker-label">${props.name.replace("Station ", "")}</span></div>`;
      iconSize = [32, 32];
    } else {
      const status = getParameterStatus(filterMode, pd.value);
      const color  = getStatusColor(status);
      // Bubble size grows with the reading (42–54 px): large enough for the text,
      // small enough that neighbouring stations overlap as little as possible
      let size = 48;
      if (pc.direction === "above") size = Math.max(42, Math.min(54, 42 + (pd.value / 10) * 12));
      else if (pc.direction === "below") size = Math.max(42, Math.min(54, 42 + Math.min(pd.value / (pc.dMax || pc.max || 1), 1) * 12));
      const ink = status === "Alert" ? "#1e293b" : "#ffffff";   // dark text on amber, white elsewhere
      iconHtml = `<div class="wq-bubble" data-id="${props.id}" title="${props.name}: ${displayValue(pd)} ${pc.unit} (${status})"
        style="width:${size}px;height:${size}px;background:${color};color:${ink};">
        <span class="wq-bubble-station">${props.name.replace("Station ", "")}</span>
        <span class="wq-bubble-label">${displayValue(pd)}</span></div>`;
      iconSize = [size, size];
    }
  }

  const icon = L.divIcon({
    html: iconHtml,
    className: "wq-divicon",
    iconSize,
    iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
  });

  const marker = L.marker(latLng, { icon, riseOnHover: true, riseOffset: 1000 });
  marker._props = props;
  marker._id    = props.id;

  marker.bindPopup(buildPopup(props), { closeButton: false, offset: [0, -10] });
  marker.on("click", () => selectStation(marker));
  return marker;
}

function buildPopup(props) {
  const color = getStatusColor(props.overallStatus);
  const dc    = DAISY_COLOR[props.overallStatus] || "neutral";
  const isNew = props.id === "stn-xxiv";
  return `<div class="popup-inner">
    <div class="popup-name">${props.name}${isNew ? ' <span style="background:#15803d;color:#fff;font-size:0.58rem;padding:0.1rem 0.4rem;border-radius:9999px;font-weight:700;vertical-align:middle;margin-left:0.3rem;">NEW</span>' : ''}</div>
    <div class="popup-bay">${props.bay}</div>
    <span class="badge badge-${dc} badge-sm font-semibold">${props.overallStatus}</span>
  </div>`;
}

function renderMarkers(data, filterMode) {
  stationMarkers.forEach(m => map.removeLayer(m));
  stationMarkers = [];
  selectedMarker = null;
  data.features.forEach(f => {
    const m = createMarker(f, filterMode);
    m.addTo(map);
    stationMarkers.push(m);
  });
}

// ── Station selection ─────────────────────────
function selectStation(marker) {
  if (selectedMarker && selectedMarker !== marker) {
    const el = selectedMarker.getElement();
    if (el) el.querySelector(".wq-marker,.wq-bubble")?.classList.remove("selected");
  }
  selectedMarker = marker;
  const el = marker.getElement();
  if (el) el.querySelector(".wq-marker,.wq-bubble")?.classList.add("selected");

  marker.openPopup();
  map.panTo(marker.getLatLng());

  const props = marker._props;
  if (props.archived) {
    showArchivedStation(props);
    return;
  }
  updateSidebar(props);
  setCurrentStation(props);

  // Mobile: expand bottom sheet
  if (window.innerWidth < 1024) {
    const sheet = document.getElementById("mobile-sheet");
    if (sheet) sheet.style.transform = "translateY(0)";
    const label = document.getElementById("sheet-label");
    if (label) label.textContent = props.name;
    updateMobileContent(props);
  }
}

function deselectStation() {
  if (selectedMarker) {
    const el = selectedMarker.getElement();
    if (el) el.querySelector(".wq-marker,.wq-bubble")?.classList.remove("selected");
    selectedMarker = null;
  }
  map.closePopup();
  showOverview();
}

// ── Sidebar ───────────────────────────────────
function updateSidebar(props) {
  const sc = DAISY_COLOR[props.overallStatus] || "neutral";
  const icon = STATUS_ICON[props.overallStatus] || "circle";
  const lastUpdated = stationMetadata?.lastUpdated || "Unknown";
  const paramBars   = renderParameterBars(props.parameters);

  document.getElementById("sidebar-content").innerHTML = `
    <div class="p-4 fade-in">
      <button class="back-to-overview" id="back-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
        Overview
      </button>

      <div class="mb-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="font-bold text-base-content text-base">${props.name}</h3>
            <p class="text-xs text-base-content opacity-50 mt-0.5">${props.bay} &middot; ${props.location}</p>
          </div>
          <span class="badge badge-${sc} gap-1 font-semibold flex-shrink-0 mt-0.5">
            <i data-lucide="${icon}" class="w-3 h-3"></i>
            ${props.overallStatus}
          </span>
        </div>
      </div>

      <div class="section-divider"></div>

      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Water Quality Parameters</p>
      <p class="text-xs opacity-40 mb-3">June 2026 readings vs. Class C limits</p>
      ${paramBars}

      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-2 mt-3">Additional Parameters</p>
      ${renderExtraParameters(props.extra)}

      <div class="section-divider"></div>

      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">Monthly Trends &middot; Q2 2026 (Apr&ndash;Jun)</p>
      <p class="text-xs opacity-40 mb-3">Dashed = Class C limit &bull; R = right Y-axis</p>
      <div id="sidebar-trend-toggles" class="flex flex-wrap gap-1.5 mb-3"></div>
      <div class="chart-wrapper"><canvas id="sidebar-trend-chart"></canvas></div>

      <div class="section-divider"></div>
      <div class="text-xs opacity-40 leading-relaxed pb-2">
        <span class="font-semibold opacity-60">Source:</span> LLDA Q2 2026 Water Quality Report &bull;
        <span class="font-semibold opacity-60">Standard:</span> DENR DAO 2016-08 / 2021-19 Class C
      </div>
    </div>`;

  document.getElementById("back-btn")?.addEventListener("click", deselectStation);

  initTrendChart("sidebar-trend-chart");
  updateTrendChart(props, "sidebar-trend-chart");
  renderTrendToggles("sidebar-trend-toggles", "sidebar-trend-chart");

  if (typeof lucide !== "undefined") lucide.createIcons();
}


// ── Archived station sidebar view ────────────
function showArchivedStation(props) {
  document.getElementById("sidebar-content").innerHTML = `
    <div class="p-4 fade-in">
      <button class="back-to-overview" id="back-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        Overview
      </button>
      <div style="text-align:center;padding:2rem 1rem;">
        <div style="width:48px;height:48px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="#64748b" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <h3 style="font-weight:700;color:#1e293b;margin-bottom:0.3rem;">${props.name}</h3>
        <p style="font-size:0.8rem;color:#64748b;margin-bottom:0.75rem;">${props.bay}</p>
        <span style="display:inline-block;background:#f1f5f9;color:#64748b;padding:0.2rem 0.75rem;border-radius:9999px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1rem;">Archived Station</span>
        <p style="font-size:0.82rem;color:#64748b;line-height:1.6;margin-bottom:0.75rem;">${props.note || "This station is no longer actively monitored in the current reporting period."}</p>
        <p style="font-size:0.75rem;color:#94a3b8;line-height:1.5;">This station was not sampled in the LLDA Q2 2026 report, so no current readings are available. It stays on the map for historical reference.</p>
      </div>
    </div>`;
  document.getElementById("back-btn")?.addEventListener("click", deselectStation);
}

function showOverview() {
  if (!stationData) return;

  let good = 0, fair = 0, poor = 0;
  let doSum = 0, bodSum = 0, phSum = 0, phosSum = 0;

  const activeFeatures = stationData.features.filter(f => !f.properties.archived);
  activeFeatures.forEach(f => {
    const p = f.properties;
    if (p.overallStatus === "Good") good++;
    else if (p.overallStatus === "Fair") fair++;
    else poor++;
    doSum   += p.parameters.do.value;
    bodSum  += p.parameters.bod.value;
    phSum   += p.parameters.ph.value;
    phosSum += p.parameters.phosphate.value;
  });
  const n = activeFeatures.length;

  const lastUpdated = stationMetadata?.lastUpdated || "Unknown";

  const SC = {
    Good: { bg:"#dcfce7", border:"#16a34a", text:"#15803d", badge:"#16a34a" },
    Fair: { bg:"#fef3c7", border:"#d97706", text:"#b45309", badge:"#d97706" },
    Poor: { bg:"#fee2e2", border:"#dc2626", text:"#b91c1c", badge:"#dc2626" }
  };

  const flipCards = stationData.features.filter(f => !f.properties.archived).map(f => {
    const p = f.properties;
    const c = SC[p.overallStatus] || SC.Good;
    const params = Object.entries(p.parameters);

    const front = [
      '<div style="background:' + c.bg + ';border:2px solid ' + c.border + ';border-radius:0.75rem;padding:1rem;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;height:100%;">',
      '<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:' + c.text + ';margin-bottom:0.3rem;">' + p.bay + '</div>',
      '<div style="font-size:1rem;font-weight:800;color:#1e293b;line-height:1.2;margin-bottom:0.6rem;">' + p.name + '</div>',
      '<span style="background:' + c.badge + ';color:#fff;padding:0.2rem 0.75rem;border-radius:9999px;font-size:0.7rem;font-weight:700;">' + p.overallStatus + '</span>',

      '</div>'
    ].join("");

    const paramRows = params.map(function(entry) {
      const k = entry[0], v = entry[1];
      const sc = v.status === "Pass" ? "#16a34a" : v.status === "Fail" ? "#b91c1c" : "#d97706";
      return '<div style="text-align:center;padding:0.3rem 0.15rem;">' +
        '<div style="font-size:0.55rem;font-weight:700;text-transform:uppercase;color:#64748b;">' + (PARAMETERS[k] ? PARAMETERS[k].short : k) + '</div>' +
        '<div style="font-size:0.85rem;font-weight:800;color:' + sc + ';">' + displayValue(v) + '</div>' +
        '<div style="font-size:0.5rem;color:#94a3b8;">' + (v.unit || "—") + '</div>' +
        '</div>';
    }).join("");

    const back = [
      '<div style="background:#fff;border:2px solid ' + c.border + ';border-radius:0.75rem;padding:0.65rem;display:flex;flex-direction:column;justify-content:center;height:100%;">',
      '<div style="font-size:0.65rem;font-weight:700;color:#1e293b;margin-bottom:0.4rem;text-align:center;">' + p.name + '</div>',
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.2rem;border:1px solid #f1f5f9;border-radius:0.4rem;overflow:hidden;background:#f8fafc;">' + paramRows + '</div>',

      '</div>'
    ].join("");

    return [
      '<div class="station-flip-card" data-id="' + p.id + '"',
      ' tabindex="0" role="button" aria-label="' + p.name + '"',
      ' style="height:140px;cursor:pointer;perspective:800px;position:relative;"',
      ' onmouseenter="this.querySelector(\'.flip-inner\').style.transform=\'rotateY(180deg)\'"',
      ' onmouseleave="this.querySelector(\'.flip-inner\').style.transform=\'rotateY(0deg)\'">',
      '<div class="flip-inner" style="position:relative;width:100%;height:100%;transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);transform-style:preserve-3d;">',
      '<div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;">' + front + '</div>',
      '<div style="position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform:rotateY(180deg);">' + back + '</div>',
      '</div></div>'
    ].join("");
  }).join("");

  document.getElementById("sidebar-content").innerHTML =
    '<div class="p-4 fade-in">' +
    '<div class="mb-3"><h3 class="font-bold text-base-content text-base">Laguna de Bay</h3><p class="text-xs opacity-50">Lake-Wide Water Quality Overview</p></div>' +

    '<div style="display:flex;gap:0.4rem;margin-bottom:0.9rem;">' +
    '<div style="flex:1;text-align:center;padding:0.5rem 0.3rem;background:#dcfce7;border:1px solid #16a34a;border-radius:0.5rem;">' +
      '<div style="font-size:1.5rem;font-weight:900;color:#15803d;line-height:1;">' + good + '</div>' +
      '<div style="font-size:0.58rem;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.15rem;">Good</div></div>' +
    '<div style="flex:1;text-align:center;padding:0.5rem 0.3rem;background:#fef3c7;border:1px solid #d97706;border-radius:0.5rem;">' +
      '<div style="font-size:1.5rem;font-weight:900;color:#b45309;line-height:1;">' + fair + '</div>' +
      '<div style="font-size:0.58rem;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.15rem;">Fair</div></div>' +
    '<div style="flex:1;text-align:center;padding:0.5rem 0.3rem;background:#fee2e2;border:1px solid #dc2626;border-radius:0.5rem;">' +
      '<div style="font-size:1.5rem;font-weight:900;color:#b91c1c;line-height:1;">' + poor + '</div>' +
      '<div style="font-size:0.58rem;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:0.05em;margin-top:0.15rem;">Poor</div></div>' +
    '</div>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.35rem;margin-bottom:0.9rem;">' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.45rem;padding:0.45rem 0.55rem;"><div style="font-size:0.6rem;font-weight:600;color:#64748b;">Avg. DO</div><div style="font-size:0.95rem;font-weight:800;color:#1e293b;">' + (doSum/n).toFixed(1) + ' <span style="font-size:0.6rem;color:#94a3b8;">mg/L</span></div><div style="font-size:0.58rem;color:#94a3b8;">&gt;= 5.0 mg/L</div></div>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.45rem;padding:0.45rem 0.55rem;"><div style="font-size:0.6rem;font-weight:600;color:#64748b;">Avg. BOD</div><div style="font-size:0.95rem;font-weight:800;color:#1e293b;">' + (bodSum/n).toFixed(1) + ' <span style="font-size:0.6rem;color:#94a3b8;">mg/L</span></div><div style="font-size:0.58rem;color:#94a3b8;">&lt;= 7.0 mg/L</div></div>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.45rem;padding:0.45rem 0.55rem;"><div style="font-size:0.6rem;font-weight:600;color:#64748b;">Avg. pH</div><div style="font-size:0.95rem;font-weight:800;color:#1e293b;">' + (phSum/n).toFixed(1) + '</div><div style="font-size:0.58rem;color:#94a3b8;">6.5 &ndash; 9.0</div></div>' +
    '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:0.45rem;padding:0.45rem 0.55rem;"><div style="font-size:0.6rem;font-weight:600;color:#64748b;">Avg. Phosphate</div><div style="font-size:0.95rem;font-weight:800;color:#b91c1c;">' + (phosSum/n).toFixed(2) + ' <span style="font-size:0.6rem;color:#94a3b8;">mg/L</span></div><div style="font-size:0.58rem;color:#94a3b8;">&le; 0.025 mg/L</div></div>' +
    '</div>' +

    '<div class="section-divider"></div>' +
    
    '<div style="display:flex;flex-direction:column;gap:0.5rem;">' + flipCards + '</div>' +

    '<div class="section-divider"></div>' +
    '<div style="font-size:0.6rem;opacity:0.4;line-height:1.5;padding-bottom:0.5rem;"><strong style="opacity:0.7;">Data:</strong> June 2026 readings &bull; Source: LLDA Q2 2026 Water Quality Report.</div>' +
    '</div>';

  document.querySelectorAll(".station-flip-card").forEach(function(card) {
    function activate() {
      const m = stationMarkers.find(function(x) { return x._id === card.dataset.id; });
      if (m) selectStation(m);
    }
    card.addEventListener("click", activate);
    card.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
  });
}

// ── Mobile content mirror ─────────────────────
function updateMobileContent(props) {
  const el = document.getElementById("mobile-content");
  if (!el) return;
  el.innerHTML = renderParameterBars(props.parameters) +
    `<div class="text-center mt-3">
      <button class="btn btn-sm btn-primary gap-1" id="open-modal-btn">
        Full Details
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </button>
    </div>`;
  document.getElementById("open-modal-btn")?.addEventListener("click", () => openModal(props));
}

// ── Station detail modal ──────────────────────
function openModal(props) {
  const sc   = DAISY_COLOR[props.overallStatus] || "neutral";
  const icon = STATUS_ICON[props.overallStatus] || "circle";

  document.getElementById("modal-title").textContent   = props.name;
  document.getElementById("modal-subtitle").textContent = `${props.bay} · ${props.location}`;

  const badge = document.getElementById("modal-badge");
  badge.className = `badge badge-${sc} badge-sm font-semibold`;
  badge.textContent = props.overallStatus;

  document.getElementById("modal-body").innerHTML = `
    <div>
      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-3">Water Quality Parameters &middot; June 2026</p>
      ${renderParameterBars(props.parameters)}
      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-2 mt-3">Additional Parameters</p>
      ${renderExtraParameters(props.extra)}
    </div>
    <div class="section-divider"></div>
    <div>
      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">Monthly Trends &middot; Q2 2026 (Apr&ndash;Jun)</p>
      <p class="text-xs opacity-40 mb-3">Dashed lines = Class C limits &bull; R badge = right Y-axis</p>
      <div id="modal-trend-toggles" class="flex flex-wrap gap-1.5 mb-3"></div>
      <div class="chart-wrapper"><canvas id="modal-trend-chart"></canvas></div>
    </div>`;

  document.getElementById("station-modal").showModal();

  setCurrentStation(props);
  initTrendChart("modal-trend-chart");
  updateTrendChart(props, "modal-trend-chart");
  renderTrendToggles("modal-trend-toggles", "modal-trend-chart");

  if (typeof lucide !== "undefined") lucide.createIcons();
}

// ── Filter dropdown ───────────────────────────
function buildFilterMenu() {
  const menu = document.getElementById("filter-menu");
  if (!menu) return;

  const items = [
    { key: "overall", label: "Overall Status", icon: "layers" },
    ...Object.entries(PARAMETERS).map(([k, p]) => ({
      key: k, label: p.label, icon: "activity"
    }))
  ];

  menu.innerHTML = items.map(item => `
    <li>
      <a href="#" class="text-sm filter-item ${item.key === currentFilter ? "active text-primary font-semibold" : ""}"
        data-key="${item.key}">${item.label}</a>
    </li>`).join("");

  menu.querySelectorAll(".filter-item").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      currentFilter = a.dataset.key;
      document.getElementById("filter-label").textContent =
        currentFilter === "overall" ? "Overall Status" : PARAMETERS[currentFilter]?.label || "Overall Status";
      renderMarkers(stationData, currentFilter);
      updateLegend(currentFilter);
      buildFilterMenu();
    });
  });
}

// ── Legend (changes with the Display Mode filter)
function updateLegend(filterMode) {
  const el = document.getElementById("legend-body");
  const title = document.getElementById("legend-title");
  if (!el || !title) return;
  const row = (color, text) =>
    `<div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${color};"></span><span class="text-xs text-base-content/80">${text}</span></div>`;
  if (filterMode === "overall") {
    title.textContent = "Water Quality";
    el.innerHTML = row("#22c55e", "Good — all meet Class C") + row("#f59e0b", "Fair — 1 outside Class C") +
      row("#ef4444", "Poor — 2+ outside Class C") + row("#94a3b8", "Archived — no Q2 2026 data");
    return;
  }
  const p = PARAMETERS[filterMode];
  title.textContent = p.label + (p.unit ? " (" + p.unit + ")" : "");
  el.innerHTML = row("#22c55e", "Pass — meets Class C") + row("#f59e0b", "Alert — Class D range") +
    row("#ef4444", "Fail — beyond Class D") + row("#94a3b8", "Archived — no data") +
    `<div class="text-xs text-base-content/60 mt-1.5 pt-1.5 border-t border-base-300">Number in circle = June 2026 value<br/>Class C limit: ${getThresholdText(filterMode)}</div>`;
}

// ── Mobile sheet toggle ───────────────────────
function setupMobileSheet() {
  const toggle = document.getElementById("sheet-toggle");
  const sheet  = document.getElementById("mobile-sheet");
  if (!toggle || !sheet) return;

  toggle.addEventListener("click", () => {
    const collapsed = sheet.style.transform !== "translateY(0px)" && sheet.style.transform !== "translateY(0)";
    sheet.style.transform = collapsed ? "translateY(0)" : "translateY(calc(100% - 52px))";
  });
}

// ── Loading overlay ───────────────────────────
const showLoading = () => { const el = document.getElementById("loading-overlay"); if (el) el.style.display = "flex"; };
const hideLoading = () => { const el = document.getElementById("loading-overlay"); if (el) el.style.display = "none"; };

// ── Bootstrap ─────────────────────────────────
async function initApp() {
  showLoading();
  try {
    initMap();
    stationData = await loadStations();
    const boundaryData = await loadLakeBoundary();

    stationMetadata = stationData.metadata || null;

    renderLakeBoundary(boundaryData);
    renderMarkers(stationData, "overall");
    buildFilterMenu();
    setupMobileSheet();
    showOverview();

    // Check URL hash for direct station link (from index.html cards)
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      const m = stationMarkers.find(x => x._id === hash);
      if (m) setTimeout(() => selectStation(m), 400);
    }

    hideLoading();
    if (typeof lucide !== "undefined") lucide.createIcons();
  } catch (err) {
    console.error("initApp failed:", err);
    hideLoading();
    const sc = document.getElementById("sidebar-content");
    if (sc) sc.innerHTML = `
      <div class="p-6 text-center">
        <p class="text-error font-semibold mb-2">Failed to Load</p>
        <p class="text-xs opacity-60">${err.message || err}</p>
        <p class="text-xs opacity-40 mt-2">Serve via: python3 -m http.server 8080</p>
      </div>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

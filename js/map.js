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
  loadStations,
  loadLakeBoundary
} from "./data.js";
import {
  renderParameterBars,
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
    minZoom: 10,
    maxZoom: 16,
    zoomControl: true,
    attributionControl: true
  });

  const bounds = L.latLngBounds([14.10, 121.00], [14.60, 121.50]);
  map.setMaxBounds(bounds);
  map.on("drag", () => map.panInsideBounds(bounds, { animate: true }));

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 19
  }).addTo(map);

  map.zoomControl.setPosition("topright");

  L.control.scale({ position: "bottomright", metric: true, imperial: false, maxWidth: 120 }).addTo(map);
}

// ── Lake boundary ─────────────────────────────
function renderLakeBoundary(geojson) {
  const layer = L.geoJSON(geojson, {
    style: {
      color: "#0ea5e9",
      weight: 2,
      opacity: 0.7,
      fillColor: "#38bdf8",
      fillOpacity: 0.1,
      dashArray: "4 3"
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
    const sc = getStatusClass(props.overallStatus);
    const label = props.name.replace("Station ", "");
    iconHtml = `<div class="wq-marker wq-marker-${sc}" data-id="${props.id}" style="width:32px;height:32px;">
      <span class="wq-marker-label">${label}</span></div>`;
    iconSize = [32, 32];
  } else {
    const pd = props.parameters[filterMode];
    const pc = PARAMETERS[filterMode];
    if (!pd || !pc) {
      const sc = getStatusClass(props.overallStatus);
      iconHtml = `<div class="wq-marker wq-marker-${sc}" data-id="${props.id}" style="width:32px;height:32px;min-width:32px;min-height:32px;">
        <span class="wq-marker-label">${props.name.replace("Station ", "")}</span></div>`;
      iconSize = [32, 32];
    } else {
      const status = getParameterStatus(filterMode, pd.value);
      const color  = getStatusColor(status);
      let size = 38;
      if (pc.direction === "above") size = Math.max(26, Math.min(58, 26 + (pd.value / 10) * 32));
      else if (pc.direction === "below") size = Math.max(26, Math.min(58, 26 + (pd.value / (pc.max || 1)) * 32));
      iconHtml = `<div class="wq-bubble" data-id="${props.id}"
        style="width:${size}px;height:${size}px;background:${color}33;border-color:${color};">
        <span class="wq-bubble-label" style="color:${color};">${pd.value}</span></div>`;
      iconSize = [size, size];
    }
  }

  const icon = L.divIcon({
    html: iconHtml,
    className: "wq-divicon",
    iconSize,
    iconAnchor: [iconSize[0] / 2, iconSize[1] / 2]
  });

  const marker = L.marker(latLng, { icon });
  marker._props = props;
  marker._id    = props.id;

  marker.bindPopup(buildPopup(props), { closeButton: false, offset: [0, -10] });
  marker.on("click", () => selectStation(marker));
  return marker;
}

function buildPopup(props) {
  const color = getStatusColor(props.overallStatus);
  const dc    = DAISY_COLOR[props.overallStatus] || "neutral";
  return `<div class="popup-inner">
    <div class="popup-name">${props.name}</div>
    <div class="popup-bay">${props.bay}</div>
    <span class="badge badge-${dc} badge-sm font-semibold">${props.overallStatus}</span>
    <div style="margin-top:0.4rem;font-size:0.7rem;opacity:0.5;">Click for full details</div>
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
  updateSidebar(props);
  setCurrentStation(props);
  updateTrendChart(props);
  renderTrendToggles("sidebar-trend-toggles");

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

      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-3">Water Quality Parameters</p>
      ${paramBars}

      <div class="section-divider"></div>

      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">6-Month Trends</p>
      <p class="text-xs opacity-40 mb-3">Dashed = DAO 2016-08 limit &bull; R = right Y-axis</p>
      <div id="sidebar-trend-toggles" class="flex flex-wrap gap-1.5 mb-3"></div>
      <div class="chart-wrapper"><canvas id="sidebar-trend-chart"></canvas></div>

      <div class="section-divider"></div>
      <div class="text-xs opacity-40 leading-relaxed pb-2">
        <span class="font-semibold opacity-60">Standard:</span> DENR DAO 2016-08 Class C &bull;
        <span class="font-semibold opacity-60">Updated:</span> ${lastUpdated}
      </div>
    </div>`;

  document.getElementById("back-btn")?.addEventListener("click", deselectStation);

  initTrendChart("sidebar-trend-chart");
  updateTrendChart(props);
  renderTrendToggles("sidebar-trend-toggles");

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function showOverview() {
  if (!stationData) return;

  let good = 0, fair = 0, poor = 0;
  let doSum = 0, bodSum = 0, phSum = 0, tempSum = 0;
  const n = stationData.features.length;

  stationData.features.forEach(f => {
    const p = f.properties;
    if (p.overallStatus === "Good") good++;
    else if (p.overallStatus === "Fair") fair++;
    else poor++;
    doSum   += p.parameters.do.value;
    bodSum  += p.parameters.bod.value;
    phSum   += p.parameters.ph.value;
    tempSum += p.parameters.temperature.value;
  });

  const lastUpdated = stationMetadata?.lastUpdated || "Unknown";

  document.getElementById("sidebar-content").innerHTML = `
    <div class="p-4 fade-in">
      <div class="mb-4">
        <h3 class="font-bold text-base-content text-base">Laguna de Bay</h3>
        <p class="text-xs opacity-50">Lake-Wide Overview</p>
      </div>

      <div class="overview-stats-row mb-4">
        <div class="overview-stat-card bg-success/10 border-success/20 text-center">
          <div class="text-2xl font-black text-success">${good}</div>
          <div class="text-xs font-semibold text-success/80 uppercase tracking-wide mt-0.5">Good</div>
        </div>
        <div class="overview-stat-card bg-warning/10 border-warning/20 text-center">
          <div class="text-2xl font-black text-warning">${fair}</div>
          <div class="text-xs font-semibold text-warning/80 uppercase tracking-wide mt-0.5">Fair</div>
        </div>
        <div class="overview-stat-card bg-error/10 border-error/20 text-center">
          <div class="text-2xl font-black text-error">${poor}</div>
          <div class="text-xs font-semibold text-error/80 uppercase tracking-wide mt-0.5">Poor</div>
        </div>
      </div>

      <div class="section-divider"></div>

      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-3">Lake-Wide Averages</p>
      <div class="overview-avg-grid mb-4">
        <div class="overview-avg-item">
          <div class="overview-avg-label">Dissolved Oxygen</div>
          <div class="overview-avg-value">${(doSum/n).toFixed(1)} <span class="overview-avg-unit">mg/L</span></div>
          <div class="overview-avg-threshold">&gt;= 5.0 mg/L</div>
        </div>
        <div class="overview-avg-item">
          <div class="overview-avg-label">BOD</div>
          <div class="overview-avg-value">${(bodSum/n).toFixed(1)} <span class="overview-avg-unit">mg/L</span></div>
          <div class="overview-avg-threshold">&lt;= 7.0 mg/L</div>
        </div>
        <div class="overview-avg-item">
          <div class="overview-avg-label">pH</div>
          <div class="overview-avg-value">${(phSum/n).toFixed(1)}</div>
          <div class="overview-avg-threshold">6.5 &ndash; 9.0</div>
        </div>
        <div class="overview-avg-item">
          <div class="overview-avg-label">Temperature</div>
          <div class="overview-avg-value">${(tempSum/n).toFixed(1)} <span class="overview-avg-unit">°C</span></div>
          <div class="overview-avg-threshold">25 &ndash; 31 °C</div>
        </div>
      </div>

      <div class="section-divider"></div>

      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-3">Monitoring Stations</p>
      <div class="overview-station-list" role="list">
        ${stationData.features.map(f => {
          const p  = f.properties;
          const sc = getStatusClass(p.overallStatus);
          const dot = sc === "good" ? "pass" : sc === "fair" ? "alert" : "fail";
          return `<div class="overview-station-item" role="button" tabindex="0"
              data-id="${p.id}" aria-label="View ${p.name}">
            <span class="param-status-dot ${dot}"></span>
            <span class="overview-station-name">${p.name}</span>
            <span class="overview-station-bay">${p.bay}</span>
          </div>`;
        }).join("")}
      </div>

      <div class="section-divider"></div>
      <div class="text-xs opacity-40 leading-relaxed pb-1">
        <span class="font-semibold opacity-60">Last Updated:</span> ${lastUpdated}<br/>
        Representative data for WITM 101 educational purposes.
      </div>

      <div class="text-center text-xs opacity-40 mt-3 pb-2">
        Click a station marker to view full details.
      </div>
    </div>`;

  // Wire station list items
  document.querySelectorAll(".overview-station-item").forEach(item => {
    const activate = () => {
      const m = stationMarkers.find(x => x._id === item.dataset.id);
      if (m) selectStation(m);
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", e => {
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
      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-3">Water Quality Parameters</p>
      ${renderParameterBars(props.parameters)}
    </div>
    <div class="section-divider"></div>
    <div>
      <p class="text-xs font-bold uppercase tracking-widest opacity-50 mb-1">6-Month Historical Trends</p>
      <p class="text-xs opacity-40 mb-3">Dashed lines = DAO 2016-08 limits &bull; R badge = right Y-axis</p>
      <div id="modal-trend-toggles" class="flex flex-wrap gap-1.5 mb-3"></div>
      <div class="chart-wrapper"><canvas id="modal-trend-chart"></canvas></div>
    </div>`;

  document.getElementById("station-modal").showModal();

  setCurrentStation(props);
  initTrendChart("modal-trend-chart");
  updateTrendChart(props);
  renderTrendToggles("modal-trend-toggles");

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
      buildFilterMenu();
    });
  });
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

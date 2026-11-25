/**
 * charts.js — Chart.js trend chart and parameter bar rendering.
 * Accepts a canvas element ID so it works in any container
 * (map sidebar, stations modal, etc.)
 */

import {
  PARAMETERS,
  EXTRA_PARAMETERS,
  getParameterStatus,
  getBarFillPercent,
  getLimitMarkerPercent,
  getStatusColor,
  getStatusClass,
  getThresholdText,
  displayValue
} from "./data.js";

/** What each status means for a Class C water body. */
export const STATUS_MEANING = {
  "Pass": "Meets Class C",
  "Alert": "Class D range",
  "Fail": "Beyond Class D",
  "No data": "Not sampled"
};

// ── Defaults ──────────────────────────────────
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.color       = "#64748b";

// ── State ─────────────────────────────────────
// Map: canvasId → { chart, activeTrendParams }
const chartInstances = new Map();
let currentStation = null;

const TREND_COLORS = {
  do:        "#0ea5e9",
  bod:       "#f97316",
  ph:        "#ec4899",
  nitrate:   "#a855f7",
  phosphate: "#ef4444",
  tss:       "#14b8a6"
};

// pH has no unit and a narrow range, so it is plotted on the right axis.
const RIGHT_AXIS = new Set(["ph"]);

// ── Threshold lines plugin ────────────────────
const thresholdLinesPlugin = {
  id: "thresholdLines",
  afterDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales) return;
    const datasets = chart.data.datasets;
    if (!datasets?.length) return;

    ctx.save();
    datasets.forEach(ds => {
      const p = PARAMETERS[ds.paramKey];
      if (!p) return;

      const axisKey = RIGHT_AXIS.has(ds.paramKey) ? "y2" : "y";
      const scale   = scales[axisKey];
      if (!scale) return;

      ctx.setLineDash([5, 4]);
      ctx.lineWidth    = 1.2;
      ctx.strokeStyle  = TREND_COLORS[ds.paramKey] || "#94a3b8";
      ctx.fillStyle    = TREND_COLORS[ds.paramKey] || "#94a3b8";
      ctx.font         = "9px Inter, sans-serif";

      const drawLine = (val, label) => {
        const y = scale.getPixelForValue(val);
        if (y < chartArea.top || y > chartArea.bottom) return;
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(label, chartArea.right - 76, y - 3);
        ctx.setLineDash([5, 4]);
      };

      if (p.direction === "above") drawLine(p.min, `${p.short} min:${p.min}`);
      else if (p.direction === "below") drawLine(p.max, `${p.short} max:${p.max}`);
      else { drawLine(p.min, `${p.short} min:${p.min}`); drawLine(p.max, `${p.short} max:${p.max}`); }
    });
    ctx.restore();
  }
};

// ── Helpers ───────────────────────────────────
function getInstance(canvasId) {
  if (!chartInstances.has(canvasId)) {
    chartInstances.set(canvasId, {
      chart: null,
      activeTrendParams: new Set(["do", "bod"])
    });
  }
  return chartInstances.get(canvasId);
}

// ── Chart init ────────────────────────────────
/**
 * Initialize (or re-initialize) the Chart.js trend chart.
 * @param {string} canvasId - ID of the <canvas> element
 */
export function initTrendChart(canvasId = "trend-chart") {
  const ctx = document.getElementById(canvasId);
  if (!ctx) {
    console.warn(`initTrendChart: canvas #${canvasId} not found`);
    return;
  }
  const inst = getInstance(canvasId);
  if (inst.chart) { inst.chart.destroy(); inst.chart = null; }

  inst.chart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [] },
    plugins: [thresholdLinesPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { usePointStyle: true, pointStyle: "circle", padding: 8, font: { size: 10 } }
        },
        tooltip: {
          backgroundColor: "rgba(15,23,42,0.92)",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label(c) {
              const unit = PARAMETERS[c.dataset.paramKey]?.unit || "";
              const shown = c.dataset.displayData?.[c.dataIndex] ?? c.parsed.y;
              const note = String(shown).startsWith("<") ? " (below detection limit)" : "";
              return `${c.dataset.label}: ${shown} ${unit}${note}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: {
          type: "linear", position: "left", beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: { font: { size: 9 } },
          title: { display: true, text: "mg/L", font: { size: 9 }, color: "#94a3b8" }
        },
        y2: {
          type: "linear", position: "right", beginAtZero: false,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 9 } },
          title: { display: true, text: "pH", font: { size: 9 }, color: "#94a3b8" }
        }
      }
    }
  });
}

// ── Chart update ──────────────────────────────
/**
 * Load trend data for the selected station into the chart.
 * @param {object} stationProps
 * @param {string} canvasId
 */
export function updateTrendChart(stationProps, canvasId = "trend-chart") {
  const inst = getInstance(canvasId);
  if (!inst.chart || !stationProps) return;

  const trends = stationProps.trends;
  if (!trends) return;

  const datasets = [];
  for (const key of inst.activeTrendParams) {
    if (!trends[key] || !PARAMETERS[key]) continue;
    const isRight = RIGHT_AXIS.has(key);
    datasets.push({
      label: PARAMETERS[key].short,
      paramKey: key,
      data: trends[key],
      displayData: trends[key + "_display"],
      yAxisID: isRight ? "y2" : "y",
      borderColor: TREND_COLORS[key] || "#64748b",
      backgroundColor: (TREND_COLORS[key] || "#64748b") + "18",
      fill: false,
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3.5,
      pointHoverRadius: 5.5,
      pointBackgroundColor: TREND_COLORS[key] || "#64748b",
      pointBorderColor: "#fff",
      pointBorderWidth: 1.5
    });
  }

  inst.chart.data.labels   = trends.months || [];
  inst.chart.data.datasets = datasets;
  inst.chart.update();
}

// ── Toggle pills ──────────────────────────────
/**
 * Render toggle pill buttons for each parameter.
 * @param {string} containerId - ID of the container element
 * @param {string} canvasId
 */
export function renderTrendToggles(containerId = "trend-toggles", canvasId = "trend-chart") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const inst   = getInstance(canvasId);
  const params = Object.keys(PARAMETERS);
  container.innerHTML = "";

  params.forEach(key => {
    const active  = inst.activeTrendParams.has(key);
    const isRight = RIGHT_AXIS.has(key);
    const color   = TREND_COLORS[key] || "#64748b";

    const btn = document.createElement("button");
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.style.cssText = `
      display:inline-flex;align-items:center;gap:0.22rem;
      padding:0.18rem 0.5rem;
      border:1px solid ${active ? color : "rgba(0,0,0,0.12)"};
      border-radius:9999px;
      font-size:0.68rem;font-weight:600;
      cursor:pointer;
      background:${active ? color + "1a" : "transparent"};
      color:${active ? color : "rgba(0,0,0,0.45)"};
      transition:all 0.15s;
      font-family:'Inter',sans-serif;
    `;

    const dot = document.createElement("span");
    dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;`;
    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(PARAMETERS[key].short));

    if (isRight) {
      const badge = document.createElement("span");
      badge.textContent = "R";
      badge.style.cssText = `font-size:0.5rem;font-weight:700;background:${active ? color : "#94a3b8"};
        color:#fff;border-radius:3px;padding:0 2px;margin-left:1px;`;
      btn.appendChild(badge);
    }

    btn.addEventListener("click", () => {
      if (inst.activeTrendParams.has(key)) {
        if (inst.activeTrendParams.size > 1) inst.activeTrendParams.delete(key);
      } else {
        inst.activeTrendParams.add(key);
      }
      renderTrendToggles(containerId, canvasId);
      if (currentStation) updateTrendChart(currentStation, canvasId);
    });

    container.appendChild(btn);
  });
}

// ── Parameter bars ────────────────────────────
/**
 * Render all 6 parameter cards as an HTML string.
 * @param {object} parameters
 * @returns {string}
 */
export function renderParameterBars(parameters) {
  let html = "";
  for (const key of Object.keys(PARAMETERS)) {
    const param = PARAMETERS[key];
    const data  = parameters[key];
    if (!data) continue;

    const status      = getParameterStatus(key, data.value);
    const statusClass = getStatusClass(status).toLowerCase();
    const fill        = getBarFillPercent(key, data.value);
    const threshold   = getThresholdText(key);
    const marker      = getLimitMarkerPercent(key);
    const markerHtml  = marker !== null
      ? `<div class="param-bar-threshold-marker" style="left:${marker}%"></div>` : "";
    const hint =
      param.direction === "above" ? "Higher is better" :
      param.direction === "below" ? "Lower is better"  : "Acceptable range";

    html += `
      <div class="param-card">
        <div class="param-card-header">
          <div class="param-name-row">
            <span class="param-status-dot ${statusClass}"></span>
            <span class="param-name">${param.label}</span>
            <span class="param-info-icon" data-tooltip="${param.description}" aria-label="${param.description}">i</span>
          </div>
          <div>
            <span class="param-value">${displayValue(data)}</span>
            <span class="param-unit">${param.unit}</span>
          </div>
        </div>
        <div class="param-bar-track">
          <div class="param-bar-fill ${statusClass}" style="width:${fill}%"></div>
          ${markerHtml}
        </div>
        <div class="param-bar-labels">
          <span>Class C: ${threshold}</span>
          <span>${hint}</span>
        </div>
        <div class="param-bar-labels" style="margin-top:0.1rem;">
          <span style="color:${getStatusColor(status)};font-weight:800;font-size:0.85rem;">${status} &middot; ${STATUS_MEANING[status] || ""}</span>
          ${data.belowDetection ? '<span>Below detection limit</span>' : ''}
        </div>
      </div>`;
  }
  return html;
}

/**
 * Render the supplementary parameters (ammonia, chloride, fecal coliform)
 * as a compact table. They count toward the overall station status.
 * @param {object} extra - Station extra readings
 * @returns {string} HTML
 */
export function renderExtraParameters(extra) {
  if (!extra || !Object.keys(extra).length) return "";
  const rows = Object.entries(EXTRA_PARAMETERS).map(([key, cfg]) => {
    const r = extra[key];
    if (!r) return "";
    const status = getParameterStatus(key, r.value);
    return `<tr>
      <td style="padding:0.35rem 0.5rem;font-weight:600;">${cfg.label}</td>
      <td style="padding:0.35rem 0.5rem;text-align:right;font-weight:700;">${displayValue(r)} <span style="font-weight:400;opacity:0.5;">${cfg.unit}</span></td>
      <td style="padding:0.35rem 0.5rem;opacity:0.6;">${getThresholdText(key)}</td>
      <td style="padding:0.35rem 0.5rem;color:${getStatusColor(status)};font-weight:700;">${status}</td>
    </tr>`;
  }).join("");
  return `<div style="border:1px solid rgba(0,0,0,0.08);border-radius:0.6rem;overflow:hidden;">
    <table style="width:100%;font-size:0.85rem;border-collapse:collapse;">
      <thead><tr style="background:rgba(0,0,0,0.04);text-align:left;">
        <th style="padding:0.35rem 0.5rem;">Parameter</th><th style="padding:0.35rem 0.5rem;text-align:right;">June</th>
        <th style="padding:0.35rem 0.5rem;">Class C</th><th style="padding:0.35rem 0.5rem;">Status</th>
      </tr></thead><tbody>${rows}</tbody></table></div>
    <p style="font-size:0.65rem;opacity:0.5;margin-top:0.35rem;">These also count toward the station&rsquo;s overall status.</p>`;
}

export function setCurrentStation(props) {
  currentStation = props;
}

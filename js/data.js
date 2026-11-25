/**
 * data.js — Parameter definitions, DENR water quality thresholds,
 * status evaluation, and data loading for the Laguna Lake Water
 * Quality Monitoring Portal.
 *
 * Readings come from the LLDA Q2 2026 (April–June 2026) Quarterly
 * Water Quality Monitoring Report. Laguna de Bay is a Class C water
 * body, so each reading is evaluated against the DENR Class C limit:
 *   - Pass  : meets the Class C guideline
 *   - Alert : falls in the Class D range (below Class C quality)
 *   - Fail  : beyond the Class D range
 * Limits are from DENR DAO 2016-08, with DAO 2021-19 for ammonia,
 * phosphate and fecal coliform.
 */

// ──────────────────────────────────────────────
// Parameter Definitions & Thresholds
// ──────────────────────────────────────────────

/**
 * Each parameter defines:
 *  - direction: "above" (higher is better), "below" (lower is better),
 *               or "range" (must stay inside a band)
 *  - min/max:       Class C limit(s)  → Pass
 *  - dMin/dMax:     Class D limit(s)  → Alert
 *  - anything beyond Class D          → Fail
 *  - source: the DENR order that sets the limit
 */
export const PARAMETERS = {
  do: {
    label: "Dissolved Oxygen", short: "DO", unit: "mg/L",
    direction: "above", min: 5, dMin: 2, source: "DAO 2016-08",
    description: "Class C requires at least 5 mg/L for fish survival"
  },
  bod: {
    label: "Biochemical Oxygen Demand", short: "BOD", unit: "mg/L",
    direction: "below", max: 7, dMax: 15, source: "DAO 2016-08",
    description: "Class C allows up to 7 mg/L; higher values mean organic pollution"
  },
  ph: {
    label: "pH Level", short: "pH", unit: "",
    direction: "range", min: 6.5, max: 9.0, dMin: 6.0, dMax: 9.0, source: "DAO 2016-08",
    description: "Class C range is 6.5 to 9.0"
  },
  nitrate: {
    label: "Nitrate", short: "Nitrate", unit: "mg/L",
    direction: "below", max: 7, dMax: 15, source: "DAO 2016-08",
    description: "Class C allows up to 7 mg/L; excess nitrate feeds algal blooms"
  },
  phosphate: {
    label: "Phosphate", short: "Phosphate", unit: "mg/L",
    direction: "below", max: 0.025, dMax: 0.05, source: "DAO 2021-19",
    description: "Class C allows up to 0.025 mg/L; excess phosphate drives eutrophication"
  },
  tss: {
    label: "Total Suspended Solids", short: "TSS", unit: "mg/L",
    direction: "below", max: 80, dMax: 110, source: "DAO 2016-08",
    description: "Class C allows up to 80 mg/L; high TSS makes water murky"
  }
};

/** Supplementary parameters shown in station details and counted in overall status. */
export const EXTRA_PARAMETERS = {
  ammonia: {
    label: "Ammonia", short: "NH3", unit: "mg/L",
    direction: "below", max: 0.06, dMax: 0.3, source: "DAO 2021-19"
  },
  chloride: {
    label: "Chloride", short: "Cl", unit: "mg/L",
    direction: "below", max: 350, dMax: 400, source: "DAO 2016-08"
  },
  fecal_coliform: {
    label: "Fecal Coliform", short: "FC", unit: "MPN/100mL",
    direction: "below", max: 200, dMax: 400, source: "DAO 2021-19"
  }
};

function cfgFor(key) { return PARAMETERS[key] || EXTRA_PARAMETERS[key]; }

// ──────────────────────────────────────────────
// Status Evaluation
// ──────────────────────────────────────────────

/**
 * Evaluate a reading against its Class C and Class D limits.
 * @param {string} paramKey - Parameter key (e.g. "do", "phosphate")
 * @param {number|null} value - Measured value
 * @returns {string} "Pass" | "Alert" | "Fail" | "No data"
 */
export function getParameterStatus(paramKey, value) {
  const p = cfgFor(paramKey);
  if (!p) return "Unknown";
  if (value === null || value === undefined || Number.isNaN(value)) return "No data";

  if (p.direction === "above") {
    if (value >= p.min) return "Pass";
    if (value > p.dMin) return "Alert";
    return "Fail";
  }
  if (p.direction === "below") {
    if (value <= p.max) return "Pass";
    if (value <= p.dMax) return "Alert";
    return "Fail";
  }
  // range
  if (value >= p.min && value <= p.max) return "Pass";
  if (value >= p.dMin && value <= p.dMax) return "Alert";
  return "Fail";
}

/**
 * Overall station status from all measured parameters
 * (the 6 core parameters plus ammonia, chloride and fecal coliform).
 * - Good: every parameter meets Class C
 * - Fair: exactly one parameter is outside Class C
 * - Poor: two or more parameters are outside Class C
 * @param {object} parameters - Core readings
 * @param {object} [extra] - Supplementary readings
 * @returns {string} "Good" | "Fair" | "Poor"
 */
export function getOverallStatus(parameters, extra = {}) {
  let outside = 0;
  for (const [key, r] of Object.entries({ ...parameters, ...extra })) {
    const s = getParameterStatus(key, r.value);
    if (s === "Alert" || s === "Fail") outside++;
  }
  if (outside >= 2) return "Poor";
  if (outside === 1) return "Fair";
  return "Good";
}

/**
 * Percentage fill (0–100) for a parameter bar. The bar's full length
 * is the edge of the Class D range, so the Class C limit marker sits
 * at a fixed point and readings past it are clearly visible.
 * @param {string} paramKey
 * @param {number} value
 * @returns {number} 0–100
 */
export function getBarFillPercent(paramKey, value) {
  const p = cfgFor(paramKey);
  if (!p || value === null || value === undefined) return 0;
  if (p.direction === "above") return Math.min(100, (value / (p.min * 2)) * 100);
  if (p.direction === "below") return Math.min(100, (value / p.dMax) * 100);
  // range: map 5.5–9.5 onto 0–100
  return Math.max(0, Math.min(100, ((value - 5.5) / 4) * 100));
}

/**
 * Position (0–100) of the Class C limit tick on a parameter bar.
 * @param {string} paramKey
 * @returns {number|null}
 */
export function getLimitMarkerPercent(paramKey) {
  const p = cfgFor(paramKey);
  if (!p) return null;
  if (p.direction === "above") return 50;
  if (p.direction === "below") return (p.max / p.dMax) * 100;
  return ((p.max - 5.5) / 4) * 100;
}

// ──────────────────────────────────────────────
// GeoJSON Validation
// ──────────────────────────────────────────────

/**
 * Validate that a parsed object is a GeoJSON FeatureCollection
 * with at least one feature and the expected geometry type.
 * @param {object} geojson - Parsed JSON object
 * @param {string} expectedGeometryType - Expected geometry type (e.g. "Point", "Polygon")
 * @param {string} label - Name of the resource for error messages
 * @throws {Error} if validation fails
 */
function validateGeoJSON(geojson, expectedGeometryType, label) {
  if (!geojson || typeof geojson !== "object") {
    throw new Error(`${label}: Invalid GeoJSON — not an object`);
  }
  if (geojson.type !== "FeatureCollection") {
    throw new Error(`${label}: Expected FeatureCollection, got "${geojson.type}"`);
  }
  if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
    throw new Error(`${label}: No features found in FeatureCollection`);
  }
  for (let i = 0; i < geojson.features.length; i++) {
    const f = geojson.features[i];
    if (!f || f.type !== "Feature") {
      throw new Error(`${label}: Feature at index ${i} is not a valid GeoJSON Feature`);
    }
    if (!f.geometry || f.geometry.type !== expectedGeometryType) {
      throw new Error(
        `${label}: Feature at index ${i} has geometry type "${f.geometry?.type}", expected "${expectedGeometryType}"`
      );
    }
    if (!f.properties || typeof f.properties !== "object") {
      throw new Error(`${label}: Feature at index ${i} has no properties`);
    }
  }
}

// ──────────────────────────────────────────────
// Data Loading Functions (async/await)
// ──────────────────────────────────────────────

/**
 * Load and validate the monitoring stations GeoJSON.
 * Expects a FeatureCollection with Point geometries containing
 * station properties (id, name, bay, overallStatus, parameters, trends).
 * @returns {Promise<object>} Parsed and validated GeoJSON FeatureCollection
 */
export async function loadStations() {
  try {
    const response = await fetch("assets/stations.json?v=7");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    // Validate GeoJSON structure
    validateGeoJSON(data, "Point", "stations.json");

    // Validate required station properties
    const requiredProps = ["id", "name", "bay", "overallStatus", "parameters"];
    data.features.forEach((f, i) => {
      for (const key of requiredProps) {
        if (!(key in f.properties)) {
          throw new Error(`stations.json: Station at index ${i} is missing required property "${key}"`);
        }
      }
    });

    // Evaluate every reading against DENR limits so status is computed
    // in one place, from the raw values.
    data.features.forEach((f) => {
      const p = f.properties;
      if (p.archived) return;
      for (const group of [p.parameters, p.extra || {}]) {
        for (const [key, r] of Object.entries(group)) {
          r.status = getParameterStatus(key, r.value);
        }
      }
      p.overallStatus = getOverallStatus(p.parameters, p.extra || {});
    });

    return data;
  } catch (err) {
    console.error("Failed to load stations.json:", err);
    throw err;
  }
}

/**
 * Load and validate the lake boundary GeoJSON polygon.
 * @returns {Promise<object>} Parsed and validated GeoJSON FeatureCollection
 */
export async function loadLakeBoundary() {
  try {
    const response = await fetch("assets/lake-boundary.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();

    // Validate GeoJSON structure
    validateGeoJSON(data, "Polygon", "lake-boundary.json");

    return data;
  } catch (err) {
    console.error("Failed to load lake-boundary.json:", err);
    throw err;
  }
}

/**
 * Convert GeoJSON Point coordinates [lng, lat] to Leaflet [lat, lng].
 * @param {number[]} coords - GeoJSON coordinates array
 * @returns {number[]} [lat, lng]
 */
export function geoJSONToLatLng(coords) {
  return [coords[1], coords[0]];
}

/**
 * Get the color associated with a status string.
 * @param {string} status - "Good" | "Fair" | "Poor" | "Pass" | "Alert" | "Fail"
 * @returns {string} Hex color
 */
export function getStatusColor(status) {
  const colors = {
    Good: "#22c55e",
    Fair: "#f59e0b",
    Poor: "#ef4444",
    Pass: "#22c55e",
    Alert: "#f59e0b",
    Fail: "#ef4444"
  };
  return colors[status] || "#64748b";
}

/**
 * Get the CSS class suffix for a status.
 * @param {string} status
 * @returns {string} "good" | "fair" | "poor" | "pass" | "alert" | "fail"
 */
export function getStatusClass(status) {
  const map = {
    Good: "good",
    Fair: "fair",
    Poor: "poor",
    Pass: "status-pass",
    Alert: "status-alert",
    Fail: "status-fail"
  };
  return map[status] || "fair";
}

/**
 * Class C limit as display text.
 * @param {string} paramKey
 * @returns {string}
 */
export function getThresholdText(paramKey) {
  const p = cfgFor(paramKey);
  if (!p) return "";
  const u = p.unit ? " " + p.unit : "";
  if (p.direction === "above") return `≥ ${p.min}${u}`;
  if (p.direction === "below") return `≤ ${p.max}${u}`;
  return `${p.min}–${p.max}${u}`;
}

/**
 * Value as shown in the UI (keeps "<0.1" below-detection readings).
 * @param {object} reading - { value, display }
 * @returns {string}
 */
export function displayValue(reading) {
  if (!reading) return "—";
  const text = reading.display ?? String(reading.value);
  return text.replace(/</g, "&lt;");   // "<0.1" is inserted as HTML
}

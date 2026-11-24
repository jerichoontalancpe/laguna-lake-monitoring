/**
 * data.js — Parameter thresholds, status evaluation, and data loading
 * for the Laguna Lake Water Quality Monitoring Portal.
 *
 * Thresholds based on DENR DAO 2016-08 Class C standards
 * (fisheries, recreation, and general purpose waters).
 */

// ──────────────────────────────────────────────
// Parameter Definitions & Thresholds
// ──────────────────────────────────────────────

/**
 * Each parameter entry defines:
 *  - label:   Display name
 *  - unit:    Measurement unit
 *  - min/max: Acceptable range (for "Pass" status)
 *  - alertMin/alertMax: Borderline threshold boundaries
 *  - direction: "above" = higher is better (e.g. DO)
 *               "below" = lower is better (e.g. BOD)
 *  - description: Short explanation for tooltips
 */
export const PARAMETERS = {
  do: {
    label: "Dissolved Oxygen",
    short: "DO",
    unit: "mg/L",
    min: 5.0,
    alertMin: 5.0,
    alertMax: 5.5,
    direction: "above",
    description: "Must be >= 5 mg/L for fish survival (Class C)"
  },
  ph: {
    label: "pH Level",
    short: "pH",
    unit: "",
    min: 6.5,
    max: 9.0,
    alertMin: 6.8,
    alertMax: 8.5,
    direction: "range",
    description: "Acceptable range 6.5-9.0 (Class C)"
  },
  bod: {
    label: "Biochemical Oxygen Demand",
    short: "BOD",
    unit: "mg/L",
    max: 7.0,
    alertMax: 5.5,
    direction: "below",
    description: "Must be <= 7 mg/L; higher indicates organic pollution"
  },
  cod: {
    label: "Chemical Oxygen Demand",
    short: "COD",
    unit: "mg/L",
    max: 25.0,
    alertMax: 20.0,
    direction: "below",
    description: "Must be <= 25 mg/L (Class C limit)"
  },
  turbidity: {
    label: "Turbidity",
    short: "Turbidity",
    unit: "NTU",
    max: 80.0,
    alertMax: 60.0,
    direction: "below",
    description: "Must be <= 80 NTU; measures water clarity"
  },
  temperature: {
    label: "Temperature",
    short: "Temp",
    unit: "\u00b0C",
    min: 25.0,
    max: 31.0,
    alertMin: 25.5,
    alertMax: 30.5,
    direction: "range",
    description: "Acceptable range 25-31 \u00b0C (Class C)"
  }
};

// ──────────────────────────────────────────────
// Status Evaluation
// ──────────────────────────────────────────────

/**
 * Evaluate a single parameter value against its thresholds.
 * @param {string} paramKey - Key in PARAMETERS (e.g. "do", "ph")
 * @param {number} value - Measured value
 * @returns {string} "Pass" | "Alert" | "Fail"
 */
export function getParameterStatus(paramKey, value) {
  const p = PARAMETERS[paramKey];
  if (!p) return "Unknown";

  switch (p.direction) {
    case "above":
      // Higher is better (DO): Fail < min, Alert between min & alertMax, Pass >= alertMax
      if (value < p.min) return "Fail";
      if (value >= p.min && value < p.alertMax) return "Alert";
      return "Pass";

    case "below":
      // Lower is better (BOD, COD, turbidity): Fail > max, Alert between alertMax & max, Pass <= alertMax
      if (value > p.max) return "Fail";
      if (value > p.alertMax && value <= p.max) return "Alert";
      return "Pass";

    case "range":
      // Range-based (pH, temperature): Fail outside min/max, Alert near boundaries
      if (value < p.min || value > p.max) return "Fail";
      if (
        (p.alertMin !== undefined && value >= p.min && value < p.alertMin) ||
        (p.alertMax !== undefined && value <= p.max && value > p.alertMax)
      ) {
        return "Alert";
      }
      return "Pass";

    default:
      return "Unknown";
  }
}

/**
 * Evaluate overall station status based on all parameter statuses.
 * - Good: All parameters Pass
 * - Fair: 1-2 parameters at Alert or one at Fail
 * - Poor: Any parameter at Fail, or 3+ at Alert
 * @param {object} parameters - Station parameters object from GeoJSON
 * @returns {string} "Good" | "Fair" | "Poor"
 */
export function getOverallStatus(parameters) {
  let passCount = 0;
  let alertCount = 0;
  let failCount = 0;

  for (const key of Object.keys(PARAMETERS)) {
    if (!parameters[key]) continue;
    const status = getParameterStatus(key, parameters[key].value);
    if (status === "Pass") passCount++;
    else if (status === "Alert") alertCount++;
    else if (status === "Fail") failCount++;
  }

  if (failCount >= 2) return "Poor";
  if (failCount === 1) return "Fair";
  if (alertCount >= 3) return "Poor";
  if (alertCount >= 1) return "Fair";
  return "Good";
}

/**
 * Calculate a percentage fill for a parameter bar (0-100%).
 *
 * For "above" parameters (DO): fill grows with the value (more = better).
 * For "below" parameters (BOD, COD, turbidity): fill grows with proximity
 *   to the max threshold (more fill = closer to limit = worse).
 * For "range" parameters (pH, temperature): fill represents position
 *   within the acceptable range.
 *
 * @param {string} paramKey
 * @param {number} value
 * @returns {number} 0-100
 */
export function getBarFillPercent(paramKey, value) {
  const p = PARAMETERS[paramKey];
  if (!p) return 0;

  switch (p.direction) {
    case "above":
      // DO: 0 at 0 mg/L, 100 at 10+ mg/L (scaled)
      return Math.min(100, (value / 10) * 100);

    case "below":
      // BOD/COD/turbidity: fill represents proximity to max threshold
      // Lower values = greener (less fill), higher = more fill (worse)
      if (p.max) return Math.min(100, (value / p.max) * 100);
      return 0;

    case "range":
      // pH/temp: position within the acceptable range
      if (p.min !== undefined && p.max !== undefined) {
        const range = p.max - p.min;
        if (value < p.min) return 100; // Off-scale = full bar (bad)
        if (value > p.max) return 100;
        return Math.min(100, ((value - p.min) / range) * 100);
      }
      return 50;

    default:
      return 0;
  }
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
    const response = await fetch("assets/stations.json");
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
    Good: "#16a34a",
    Fair: "#d97706",
    Poor: "#dc2626",
    Pass: "#16a34a",
    Alert: "#d97706",
    Fail: "#dc2626"
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
    Pass: "pass",
    Alert: "alert",
    Fail: "fail"
  };
  return map[status] || "fair";
}

/**
 * Get the threshold description for display.
 * @param {string} paramKey
 * @returns {string} Human-readable threshold
 */
export function getThresholdText(paramKey) {
  const p = PARAMETERS[paramKey];
  if (!p) return "";

  switch (p.direction) {
    case "above":
      return `>= ${p.min} ${p.unit}`;
    case "below":
      return `<= ${p.max} ${p.unit}`;
    case "range":
      return `${p.min}-${p.max} ${p.unit}`;
    default:
      return "";
  }
}

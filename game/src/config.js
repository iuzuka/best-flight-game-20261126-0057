// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// The world is a chase view: the plane flies forward over an island archipelago, and every
// distance is in metres ahead of the plane, every altitude in feet above the sea.
export const FIELD = { width: 1280, height: 720, horizonY: 296 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Knots to metres per second. */
export const KNOT_MS = 0.514444;

export const PLANE = {
  /** Lateral position, -1 (far left) to 1 (far right); the plane never leaves the sky. */
  xMin: -1,
  xMax: 1,
  /** How fast the plane slides sideways when banked, in x units per second. */
  lateralSpeed: 0.85,
  /** Degrees of heading change per second at full bank. */
  turnRate: 26,
  /** Roll shown on screen at full bank, in radians. */
  maxRoll: 0.42,
  /** Feet per second of climb at full pitch up; descent is a little faster. */
  climbRate: 950,
  descendRate: 1250,
  altMin: 120,
  altMax: 8200,
  speedMin: 130,
  speedMax: 310,
  cruiseSpeed: 205,
  /** Knots per second gained or lost on the throttle. */
  throttleRate: 55,
  /** Extra knots per second while boosting, and the extra fuel it burns. */
  boostSpeed: 60,
  boostFuel: 0.55,
};

export const LEGS = [
  { name: 'PULAU KENCANA', distance: 5200, rings: 8, peaks: 2, storms: 3, parcels: 5 },
  { name: 'TELUK ZAMRUD', distance: 6200, rings: 10, peaks: 3, storms: 4, parcels: 6 },
  { name: 'GUNUNG BERAPI', distance: 7200, rings: 12, peaks: 5, storms: 5, parcels: 6 },
];

export const RING = { points: 100, radiusFt: 420, radiusX: 0.16 };
export const PARCEL = { points: 50, radiusFt: 300, radiusX: 0.12 };
export const STORM = { radiusFt: 700, radiusX: 0.22 };
export const PEAK = { minHeightFt: 3800, maxHeightFt: 6800, halfWidth: 0.16 };

export const FUEL = {
  start: 100,
  /** Units burned per second at cruise; faster flight burns a little more. */
  burn: 0.32,
  burnPerKnot: 0.0011,
  lowWarn: 25,
};

export const HULL = 3;
export const LAND_ALT_FT = 420;
export const LAND_SPEED_KT = 215;
export const LAND_POINTS = 500;
export const RUNWAY_RECYCLE_M = 1600;

export const POOL_SIZE = 96;

export const PALETTE = {
  skyTop: '#16324f',
  skyMid: '#3f6d8e',
  skyLow: '#f2a35e',
  horizonGlow: '#ffb36b',
  sun: '#ffe9a8',
  sunCore: '#fff6d8',
  sea: '#1d6f8e',
  seaGlint: '#7fd4e8',
  sand: '#e8cf9a',
  groundFar: '#7fae6d',
  groundNear: '#4d8a4a',
  fieldGreen: '#5da24f',
  fieldGold: '#d9b45b',
  fieldDark: '#3f7d3e',
  road: '#8d8578',
  river: '#2f8fb5',
  house: '#f3e2c7',
  roof: '#c65a3c',
  mountainFar: '#5b6f8f',
  mountainNear: '#3d4f6e',
  volcano: '#4a3f4d',
  volcanoSmoke: '#cfc4bb',
  cloud: '#fff4e0',
  cloudShade: '#e8c9a8',
  storm: '#4b4258',
  stormDark: '#332c40',
  ring: '#ffd34d',
  ringGlow: '#ff9d2e',
  parcel: '#e8a13c',
  parcelDark: '#9c5f1e',
  planeBody: '#f4f1e8',
  planeTeal: '#0f7d8c',
  planeOrange: '#f07830',
  planeDark: '#22303c',
  panel: '#1b2430',
  panelEdge: '#33465c',
  gaugeGlow: '#ffb84d',
  gaugeGreen: '#7de3a8',
  text: '#f4f1e8',
  muted: '#b9c2cc',
  danger: '#ff5d4d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nusantara-sky-courier.best';

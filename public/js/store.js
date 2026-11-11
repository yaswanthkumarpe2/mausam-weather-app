// Saves the profile and last forecast on the device, with no account needed. Nothing
// here leaves the browser. Storage can be missing or blocked, so every access is
// guarded and the app still works without it.
import { EMPTY_STATS } from './achievements.js';

const PREFS_KEY = 'mausam.prefs.v1';
const CACHE_PREFIX = 'mausam.forecast.';

export const DEFAULT_PREFS = {
  onboarded: false,
  name: '',
  lang: 'en',
  theme: 'auto',
  units: { temp: 'c', wind: 'kmh' },
  personas: [],
  locations: [],
  activeLocationId: null,
  layout: { order: null, hidden: null },
  thresholds: { rain: 60, heat: 40, wind: 45, aqi: 150 },
  farm: { crop: 'rice', stage: 'mid' },
  health: { conditions: [] },
  bigText: false,
  notifications: false,
  displayName: '',
  stats: EMPTY_STATS,
  alertLog: [],
  confirmed: [],
};

const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

// Fills in anything missing, so prefs saved by older versions keep working.
export function mergePrefs(saved) {
  const base = structuredClone(DEFAULT_PREFS);
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    units: { ...base.units, ...saved.units },
    layout: { ...base.layout, ...saved.layout },
    thresholds: { ...base.thresholds, ...saved.thresholds },
    farm: { ...base.farm, ...saved.farm },
    health: { ...base.health, ...saved.health },
    stats: { ...base.stats, ...saved.stats },
  };
}

export function loadPrefs(storage = browserStorage()) {
  try {
    return mergePrefs(JSON.parse(storage?.getItem(PREFS_KEY) ?? 'null'));
  } catch {
    return mergePrefs(null);
  }
}

export function savePrefs(prefs, storage = browserStorage()) {
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or blocked: the app carries on for this visit.
  }
}

export function readForecast(locationId, storage = browserStorage()) {
  try {
    return JSON.parse(storage?.getItem(CACHE_PREFIX + locationId) ?? 'null');
  } catch {
    return null;
  }
}

export function saveForecast(locationId, forecast, storage = browserStorage()) {
  try {
    storage?.setItem(CACHE_PREFIX + locationId, JSON.stringify(forecast));
  } catch {
    // Same as savePrefs: losing the cache only costs offline support.
  }
}

export function eraseAll(storage = browserStorage()) {
  try {
    Object.keys(storage ?? {})
      .filter((key) => key.startsWith('mausam.'))
      .forEach((key) => storage.removeItem(key));
  } catch {
    // Nothing to erase if storage is unavailable.
  }
}

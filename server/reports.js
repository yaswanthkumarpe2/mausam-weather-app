// Member 4: community weather reports. Validation and queries are kept apart from
// the HTTP server so they can be tested directly.

export const REPORT_TYPES = ['clear', 'rain', 'heavyRain', 'waterlogging', 'storm', 'fog', 'heat', 'dust'];
export const REPORT_LIFETIME_MS = 6 * 60 * 60 * 1000;
export const MAX_NOTE = 140;
export const MAX_NAME = 24;
const MAX_STORED = 500;

const EARTH_KM = 6371;
const toRad = (degrees) => (degrees * Math.PI) / 180;

function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

const cleanText = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Returns { report } or { error }. Coordinates are rounded to about 1 km.
export function createReport(input, { now = Date.now(), id } = {}) {
  const lat = Number(input?.lat);
  const lon = Number(input?.lon);
  if (!REPORT_TYPES.includes(input?.type)) return { error: 'Unknown report type' };
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { error: 'Invalid location' };
  }
  return {
    report: {
      id,
      type: input.type,
      note: cleanText(input.note, MAX_NOTE),
      name: cleanText(input.name, MAX_NAME),
      place: cleanText(input.place, 60),
      lat: Math.round(lat * 100) / 100,
      lon: Math.round(lon * 100) / 100,
      at: now,
      confirms: 0,
    },
  };
}

export const activeReports = (reports, now = Date.now()) =>
  reports.filter((report) => now - report.at < REPORT_LIFETIME_MS);

export function reportsNear(reports, { lat, lon, radiusKm = 100, now = Date.now() }) {
  return activeReports(reports, now)
    .map((report) => ({ ...report, km: Math.round(distanceKm({ lat, lon }, report)) }))
    .filter((report) => report.km <= radiusKm)
    .sort((a, b) => b.at - a.at);
}

export function addReport(reports, report, now = Date.now()) {
  return [report, ...activeReports(reports, now)].slice(0, MAX_STORED);
}

export function confirmReport(reports, id) {
  let found = null;
  const updated = reports.map((report) => {
    if (report.id !== id) return report;
    found = { ...report, confirms: report.confirms + 1 };
    return found;
  });
  return { reports: updated, report: found };
}

// A simple per-address limit: a few posts each minute.
export function createRateLimiter({ limit = 6, windowMs = 60000 } = {}) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now]);
    return true;
  };
}

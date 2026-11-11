// Member 4: weather along a journey. The route is a straight line between the two
// places at an assumed average speed, so times are estimates. The UI says so.
import { isThunder } from './weather-codes.js';

const EARTH_KM = 6371;
const toRad = (degrees) => (degrees * Math.PI) / 180;
const pad = (n) => String(n).padStart(2, '0');

export const ROAD_FACTOR = 1.25; // Roads are longer than the straight line.
export const SPEED_KMH = 55;

export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export function roadEstimate(a, b) {
  const km = distanceKm(a, b) * ROAD_FACTOR;
  return { km: Math.round(km), hours: km / SPEED_KMH };
}

export function waypoints(a, b, count = 5) {
  return Array.from({ length: count }, (_, i) => {
    const part = i / (count - 1);
    return { part, lat: a.lat + (b.lat - a.lat) * part, lon: a.lon + (b.lon - a.lon) * part };
  });
}

// Adds whole hours to "YYYY-MM-DDTHH:00" without involving the device's time zone.
export function addHours(iso, hours) {
  const date = new Date(`${iso.slice(0, 13)}:00:00Z`);
  date.setUTCHours(date.getUTCHours() + Math.round(hours));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:00`;
}

export function riskOf(hour) {
  if (!hour) return 0;
  let risk = 0;
  if (isThunder(hour.code)) risk += 3;
  if (hour.pop >= 70) risk += 2;
  else if (hour.pop >= 40) risk += 1;
  if (hour.precipMm >= 4) risk += 1;
  if (hour.windKmh >= 40) risk += 1;
  if (hour.visibility != null && hour.visibility < 1000) risk += 2;
  return risk;
}

// `forecasts` holds one hourly list per waypoint, in route order.
export function assessTrip(forecasts, departure, totalHours) {
  const stops = forecasts.map((hourly, index) => {
    const offset = (totalHours * index) / (forecasts.length - 1);
    const eta = addHours(departure, offset);
    const hour = hourly.find((h) => h.time === eta) ?? null;
    return { index, eta, hour, risk: riskOf(hour) };
  });
  const known = stops.filter((stop) => stop.hour);
  const worst = known.length ? Math.max(...known.map((stop) => stop.risk)) : 0;
  const total = known.reduce((sum, stop) => sum + stop.risk, 0);
  let verdict = 'good';
  if (worst >= 3 || total >= 6) verdict = 'bad';
  else if (worst >= 1) verdict = 'caution';
  return { stops, total, worst, verdict, complete: known.length === stops.length };
}

// Tries each daytime start over the next day and keeps the least risky.
export function bestDeparture(forecasts, firstDeparture, totalHours, tries = 24) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const departure = addHours(firstDeparture, i);
    const hour = Number(departure.slice(11, 13));
    if (hour < 5 || hour > 20) continue;
    const trip = assessTrip(forecasts, departure, totalHours);
    if (trip.complete && (!best || trip.total < best.total)) best = { departure, total: trip.total, verdict: trip.verdict };
  }
  return best;
}

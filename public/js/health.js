// Member 3: the Health hub. General guidance only, not medical advice; the UI says so.
import { hourOf } from './format.js';

export const CONDITIONS = [
  { id: 'asthma', icon: 'lungs' },
  { id: 'heart', icon: 'heart' },
  { id: 'elderly', icon: 'walk' },
  { id: 'children', icon: 'child' },
];

// Reference values in µg/m³, based on WHO air quality guideline levels.
export const POLLUTANTS = [
  { id: 'pm25', label: 'PM2.5', limit: 15 },
  { id: 'pm10', label: 'PM10', limit: 45 },
  { id: 'o3', label: 'O₃', limit: 100 },
  { id: 'no2', label: 'NO₂', limit: 25 },
  { id: 'so2', label: 'SO₂', limit: 40 },
  { id: 'co', label: 'CO', limit: 4000 },
];

export function pollutantLevels(air) {
  return POLLUTANTS.flatMap(({ id, label, limit }) => {
    const value = air[id];
    if (value == null) return [];
    const ratio = value / limit;
    return [{ id, label, value: Math.round(value), limit, ratio, level: ratio <= 1 ? 'good' : ratio <= 2.5 ? 'watch' : 'warn' }];
  });
}

export function mainPollutant(air) {
  const levels = pollutantLevels(air);
  return levels.length ? levels.reduce((a, b) => (b.ratio > a.ratio ? b : a)) : null;
}

// Heat index (NOAA Rothfusz regression), converted to and from Fahrenheit.
export function heatIndex(tempC, humidity) {
  if (tempC < 27 || humidity == null) return tempC;
  const t = (tempC * 9) / 5 + 32;
  const r = humidity;
  const f = -42.379 + 2.04901523 * t + 10.14333127 * r - 0.22475541 * t * r - 0.00683783 * t * t
    - 0.05481717 * r * r + 0.00122874 * t * t * r + 0.00085282 * t * r * r - 0.00000199 * t * t * r * r;
  return Math.round((((f - 32) * 5) / 9) * 10) / 10;
}

export function heatBand(index) {
  if (index < 27) return 'comfortable';
  if (index < 32) return 'caution';
  if (index < 41) return 'extremeCaution';
  if (index < 54) return 'danger';
  return 'extremeDanger';
}

// The AQI forecast is hourly but may end before the weather forecast does.
function aqiAt(air, time) {
  if (!air) return null;
  return air.hourly?.find((h) => h.time === time)?.aqi ?? air.aqi;
}

export function safeHours(wx, conditions = [], hours = 24) {
  const sensitive = conditions.length > 0;
  const aqiCaution = sensitive ? 75 : 100;
  const aqiAvoid = sensitive ? 125 : 150;
  const heatCaution = sensitive ? 32 : 36;
  const heatAvoid = sensitive ? 37 : 41;

  return wx.hourly.slice(0, hours).map((hour) => {
    const aqi = aqiAt(wx.air, hour.time);
    let status = 'good';
    if ((aqi != null && aqi >= aqiCaution) || hour.feels >= heatCaution || hour.uv >= 8 || hour.pop >= 60) status = 'caution';
    if ((aqi != null && aqi >= aqiAvoid) || hour.feels >= heatAvoid || hour.feels <= 5) status = 'avoid';
    return { time: hour.time, status, aqi, uv: hour.uv, feels: hour.feels };
  });
}

export function bestOutdoorHour(slots) {
  const run = { start: -1, best: null };
  slots.forEach((slot, index) => {
    const usable = slot.status === 'good' && hourOf(slot.time) >= 5 && hourOf(slot.time) <= 21;
    if (usable && run.start < 0) run.start = index;
    const ended = !usable || index === slots.length - 1;
    if (ended && run.start >= 0) {
      const end = usable ? index + 1 : index;
      if (!run.best || end - run.start > run.best.hours) {
        run.best = { from: slots[run.start].time, to: slots[end]?.time ?? slots[end - 1].time, hours: end - run.start };
      }
      run.start = -1;
    }
  });
  return run.best;
}

export function uvWindow(hourly) {
  const today = hourly.slice(0, 24).filter((h) => h.uv >= 3);
  return today.length ? { from: today[0].time, to: today.at(-1).time } : null;
}

export function conditionAdvice(wx, conditions) {
  const tips = [];
  const aqi = wx.air?.aqi ?? 0;
  const peakFeels = Math.max(...wx.hourly.slice(0, 24).map((h) => h.feels));
  const lowFeels = Math.min(...wx.hourly.slice(0, 24).map((h) => h.feels));
  const has = (id) => conditions.includes(id);

  if (has('asthma')) {
    if (aqi > 100) tips.push({ id: 'asthmaAir', severity: 'warn', params: { aqi } });
    else tips.push({ id: 'asthmaOk', severity: 'good', params: { aqi } });
    if (lowFeels < 15) tips.push({ id: 'asthmaCold', severity: 'watch', params: {} });
  }
  if (has('heart') && peakFeels >= 36) tips.push({ id: 'heartHeat', severity: 'warn', params: { peakTemp: peakFeels } });
  if (has('heart') && aqi > 150) tips.push({ id: 'heartAir', severity: 'warn', params: { aqi } });
  if (has('elderly') && peakFeels >= 35) tips.push({ id: 'elderlyHeat', severity: 'warn', params: { peakTemp: peakFeels } });
  if (has('elderly') && lowFeels < 12) tips.push({ id: 'elderlyCold', severity: 'watch', params: { lowTemp: lowFeels } });
  if (has('children') && (aqi > 100 || peakFeels >= 36)) tips.push({ id: 'childrenPlay', severity: 'watch', params: {} });
  if (has('children') && wx.daily[0].uvMax >= 8) tips.push({ id: 'childrenSun', severity: 'watch', params: {} });

  if (peakFeels >= 33) tips.push({ id: 'hydrate', severity: 'info', params: {} });
  if (!tips.length) tips.push({ id: 'allClear', severity: 'good', params: {} });
  return tips;
}

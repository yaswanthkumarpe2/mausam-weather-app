// Formatting helpers. Forecast timestamps are local to the *forecast location*
// ("2026-11-05T14:00", no offset), so everything here works on the string and
// formats in UTC to stop the device's own time zone from shifting the value.

export const hourOf = (iso) => Number(iso.slice(11, 13));
export const dateOf = (iso) => iso.slice(0, 10);
export const minutesOf = (iso) => hourOf(iso) * 60 + Number(iso.slice(14, 16));

const asUtcDate = (iso) =>
  new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : `${iso.slice(0, 16)}:00Z`);

const localeOf = (lang) => (lang === 'hi' ? 'hi-IN' : 'en-IN');

export function addDays(date, days) {
  const d = asUtcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtHour(iso, lang) {
  return new Intl.DateTimeFormat(localeOf(lang), {
    hour: 'numeric',
    hour12: true,
    timeZone: 'UTC',
  }).format(asUtcDate(iso));
}

export function fmtClock(iso, lang) {
  return new Intl.DateTimeFormat(localeOf(lang), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(asUtcDate(iso));
}

export function fmtWeekday(date, lang) {
  return new Intl.DateTimeFormat(localeOf(lang), {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(asUtcDate(date));
}

export function fmtLongDate(iso, lang) {
  return new Intl.DateTimeFormat(localeOf(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(asUtcDate(iso));
}

export function fmtMonth(date, lang) {
  return new Intl.DateTimeFormat(localeOf(lang), { month: 'short', timeZone: 'UTC' }).format(asUtcDate(date));
}

export function fmtRelativeDay(date, today, t, lang) {
  if (date === today) return t('day.today');
  if (date === addDays(today, 1)) return t('day.tomorrow');
  return fmtWeekday(date, lang);
}

export const toUnitTemp = (celsius, unit) =>
  Math.round(unit === 'f' ? (celsius * 9) / 5 + 32 : celsius);

export const fmtTemp = (celsius, unit) => `${toUnitTemp(celsius, unit)}°`;

export function fmtWind(kmh, unit) {
  return unit === 'mph'
    ? `${Math.round(kmh * 0.621371)} mph`
    : `${Math.round(kmh)} km/h`;
}

export function fmtVisibility(metres) {
  if (metres == null) return '–';
  return metres >= 1000 ? `${Math.round(metres / 1000)} km` : `${Math.round(metres)} m`;
}

export function compassPoint(degrees) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

// US AQI bands. India's CPCB index uses different breakpoints, so the UI always
// labels this value as "US AQI".
export function aqiBand(aqi) {
  if (aqi <= 50) return 'good';
  if (aqi <= 100) return 'moderate';
  if (aqi <= 150) return 'sensitive';
  if (aqi <= 200) return 'unhealthy';
  if (aqi <= 300) return 'veryUnhealthy';
  return 'hazardous';
}

export function uvBand(uv) {
  if (uv < 3) return 'low';
  if (uv < 6) return 'moderate';
  if (uv < 8) return 'high';
  if (uv < 11) return 'veryHigh';
  return 'extreme';
}

// Turns the raw params on an insight or alert into display strings. Naming
// convention: *At = hour, day = date, *Temp = temperature, *Wind = speed.
export function formatParams(params, { t, lang, units, today }) {
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.endsWith('At')) out[key] = fmtHour(value, lang);
    else if (key === 'day') out[key] = fmtRelativeDay(value, today, t, lang);
    else if (key.endsWith('Temp')) out[key] = fmtTemp(value, units.temp);
    else if (key.endsWith('Wind')) out[key] = fmtWind(value, units.wind);
    else if (key === 'slot') out[key] = t(`commute.${value}`);
    else if (key === 'cond') out[key] = t(`wx.${value}`);
    else out[key] = value;
  }
  return out;
}

export function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

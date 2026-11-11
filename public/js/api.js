// Member 2: data layer. Everything else in the app depends only on the shape
// normalize() returns, so another provider (such as IMD's API) can be swapped in here.

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 12000;

const CURRENT_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day', 'precipitation',
  'weather_code', 'cloud_cover', 'pressure_msl', 'wind_speed_10m', 'wind_direction_10m',
  'wind_gusts_10m',
];
const HOURLY_FIELDS = [
  'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
  'weather_code', 'is_day', 'wind_speed_10m', 'wind_gusts_10m', 'uv_index', 'visibility',
  'soil_moisture_3_to_9cm', 'soil_temperature_6cm', 'relative_humidity_2m', 'cloud_cover',
];
const DAILY_FIELDS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
  'precipitation_probability_max', 'sunrise', 'sunset', 'uv_index_max',
  'et0_fao_evapotranspiration', 'wind_speed_10m_max',
];
const AIR_CURRENT_FIELDS = [
  'us_aqi', 'pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide',
];

async function getJson(base, params) {
  const url = `${base}?${new URLSearchParams(params)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  return response.json();
}

function normalizeAir(airRaw, startHour) {
  const c = airRaw?.current;
  if (c?.us_aqi == null) return null;
  const times = airRaw.hourly?.time ?? [];
  const start = Math.max(times.indexOf(startHour), 0);
  return {
    aqi: c.us_aqi,
    pm25: c.pm2_5,
    pm10: c.pm10,
    o3: c.ozone ?? null,
    no2: c.nitrogen_dioxide ?? null,
    so2: c.sulphur_dioxide ?? null,
    co: c.carbon_monoxide ?? null,
    hourly: times.slice(start).flatMap((time, offset) => {
      const aqi = airRaw.hourly.us_aqi[start + offset];
      return aqi == null ? [] : [{ time, aqi }];
    }),
  };
}

export function normalize(raw, airRaw, fetchedAt = Date.now()) {
  const c = raw.current;
  const h = raw.hourly;
  const d = raw.daily;

  // Hourly data starts at midnight; the app wants it to start at the current hour.
  const startHour = `${c.time.slice(0, 13)}:00`;
  const start = Math.max(h.time.indexOf(startHour), 0);

  return {
    source: 'open-meteo',
    fetchedAt,
    current: {
      time: c.time,
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      code: c.weather_code,
      isDay: c.is_day === 1,
      precipMm: c.precipitation,
      cloud: c.cloud_cover,
      pressure: c.pressure_msl,
      windKmh: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
      gustKmh: c.wind_gusts_10m,
    },
    hourly: h.time.slice(start).map((time, offset) => {
      const i = start + offset;
      return {
        time,
        temp: h.temperature_2m[i],
        feels: h.apparent_temperature[i],
        pop: h.precipitation_probability[i] ?? 0,
        precipMm: h.precipitation[i] ?? 0,
        code: h.weather_code[i],
        isDay: h.is_day[i] === 1,
        windKmh: h.wind_speed_10m[i] ?? 0,
        gustKmh: h.wind_gusts_10m[i] ?? 0,
        uv: h.uv_index[i] ?? 0,
        visibility: h.visibility[i] ?? null,
        soil: h.soil_moisture_3_to_9cm[i] ?? null,
        soilTemp: h.soil_temperature_6cm?.[i] ?? null,
        humidity: h.relative_humidity_2m?.[i] ?? null,
        cloud: h.cloud_cover?.[i] ?? null,
      };
    }),
    daily: d.time.map((date, i) => ({
      date,
      code: d.weather_code[i],
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      pop: d.precipitation_probability_max[i] ?? 0,
      precipMm: d.precipitation_sum[i] ?? 0,
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
      uvMax: d.uv_index_max[i] ?? 0,
      et0: d.et0_fao_evapotranspiration[i] ?? 0,
      windMax: d.wind_speed_10m_max?.[i] ?? 0,
    })),
    air: normalizeAir(airRaw, startHour),
  };
}

export async function fetchWeather({ lat, lon }) {
  const place = { latitude: lat, longitude: lon, timezone: 'auto' };
  const [forecast, air] = await Promise.all([
    getJson(FORECAST_URL, {
      ...place,
      forecast_days: 14,
      current: CURRENT_FIELDS.join(','),
      hourly: HOURLY_FIELDS.join(','),
      daily: DAILY_FIELDS.join(','),
    }),
    // Air quality is a nice-to-have: a failure here shouldn't lose the forecast.
    getJson(AIR_URL, {
      ...place,
      forecast_days: 3,
      current: AIR_CURRENT_FIELDS.join(','),
      hourly: 'us_aqi',
    }).catch(() => null),
  ]);
  return normalize(forecast, air);
}

export async function searchPlaces(query) {
  const data = await getJson(GEOCODE_URL, { name: query, count: 6, language: 'en', format: 'json' });
  return (data.results ?? []).map((r) => ({
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(', '),
    lat: r.latitude,
    lon: r.longitude,
  }));
}

const asList = (data) => (Array.isArray(data) ? data : [data]);
const coords = (points) => ({
  latitude: points.map((p) => p.lat.toFixed(3)).join(','),
  longitude: points.map((p) => p.lon.toFixed(3)).join(','),
});

// Current conditions for many places in one request, for the map layers.
export async function fetchCities(points) {
  const [weather, air] = await Promise.all([
    getJson(FORECAST_URL, {
      ...coords(points),
      timezone: 'auto',
      current: 'temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,precipitation',
    }),
    getJson(AIR_URL, { ...coords(points), current: 'us_aqi' }).catch(() => null),
  ]);
  const airList = air ? asList(air) : [];
  return asList(weather).map((item, i) => ({
    ...points[i],
    temp: item.current.temperature_2m,
    code: item.current.weather_code,
    isDay: item.current.is_day === 1,
    windKmh: item.current.wind_speed_10m,
    windDir: item.current.wind_direction_10m,
    aqi: airList[i]?.current?.us_aqi ?? null,
  }));
}

// Hourly forecasts for points along a trip, one list per point.
export async function fetchRoute(points) {
  const data = await getJson(FORECAST_URL, {
    ...coords(points),
    timezone: 'auto',
    forecast_days: 7,
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,visibility,is_day',
  });
  return asList(data).map(({ hourly: h }) => h.time.map((time, i) => ({
    time,
    temp: h.temperature_2m[i],
    pop: h.precipitation_probability[i] ?? 0,
    precipMm: h.precipitation[i] ?? 0,
    code: h.weather_code[i],
    windKmh: h.wind_speed_10m[i] ?? 0,
    visibility: h.visibility[i] ?? null,
    isDay: h.is_day[i] === 1,
  })));
}

// Five years of daily history. The archive runs a few days behind today.
export async function fetchArchive({ lat, lon }, today) {
  const year = Number(today.slice(0, 4));
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 6);
  const data = await getJson(ARCHIVE_URL, {
    latitude: lat,
    longitude: lon,
    timezone: 'auto',
    start_date: `${year - 5}-01-01`,
    end_date: end.toISOString().slice(0, 10),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
  });
  return {
    time: data.daily.time,
    max: data.daily.temperature_2m_max,
    min: data.daily.temperature_2m_min,
    rain: data.daily.precipitation_sum,
  };
}

// Community reports come from this project's own server.
export async function fetchReports({ lat, lon }, radius = 100) {
  const response = await fetch(`/api/reports?lat=${lat}&lon=${lon}&radius=${radius}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error('Reports unavailable');
  return (await response.json()).reports;
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

export const postReport = (report) => postJson('/api/reports', report);
export const confirmReportOnServer = (id) => postJson(`/api/reports/${id}/confirm`, {});

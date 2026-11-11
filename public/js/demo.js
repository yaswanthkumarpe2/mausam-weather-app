// Made-up forecast used when live data is unreachable and nothing is cached, or
// with ?demo in the URL. It has the same shape as normalize() in api.js, and the
// homepage always labels it as sample data.
import { addDays, dateOf } from './format.js';

const pad = (n) => String(n).padStart(2, '0');

function localIso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sampleHour(date, dayIndex, hour) {
  const isDay = hour >= 6 && hour < 18;
  const rainy = dayIndex % 3 === 0 && hour >= 15 && hour < 20;
  const temp = 28 - dayIndex * 0.2 + 5 * Math.sin(((hour - 9) * Math.PI) / 12);
  const windKmh = 9 + 4 * Math.sin(hour / 3);
  return {
    time: `${date}T${pad(hour)}:00`,
    temp: Math.round(temp * 10) / 10,
    feels: Math.round((temp + 2) * 10) / 10,
    pop: rainy ? 70 : 10,
    precipMm: rainy ? 2 : 0,
    code: rainy ? 63 : hour >= 10 && hour < 15 ? 2 : 1,
    isDay,
    windKmh: Math.round(windKmh),
    gustKmh: Math.round(windKmh * 1.6),
    uv: isDay ? Math.max(0, Math.round(8 * Math.sin(((hour - 6) * Math.PI) / 12))) : 0,
    visibility: 9000,
    soil: 0.24,
    soilTemp: 26,
    humidity: rainy ? 88 : 62,
    cloud: rainy ? 90 : 35,
  };
}

export function demoForecast(now = new Date()) {
  const nowIso = localIso(now);
  const today = dateOf(nowIso);
  const allHours = [];
  const daily = [];

  for (let day = 0; day < 14; day++) {
    const date = addDays(today, day);
    const hours = Array.from({ length: 24 }, (_, hour) => sampleHour(date, day, hour));
    allHours.push(...hours);
    const temps = hours.map((h) => h.temp);
    daily.push({
      date,
      code: day % 3 === 0 ? 63 : 2,
      max: Math.max(...temps),
      min: Math.min(...temps),
      pop: Math.max(...hours.map((h) => h.pop)),
      precipMm: hours.reduce((total, h) => total + h.precipMm, 0),
      sunrise: `${date}T06:10`,
      sunset: `${date}T17:50`,
      uvMax: Math.max(...hours.map((h) => h.uv)),
      et0: 4,
      windMax: Math.max(...hours.map((h) => h.windKmh)),
    });
  }

  const hourly = allHours.filter((h) => h.time >= `${nowIso.slice(0, 13)}:00`);
  const first = hourly[0];

  return {
    source: 'demo',
    fetchedAt: now.getTime(),
    current: {
      time: nowIso,
      temp: first.temp,
      feels: first.feels,
      humidity: 62,
      code: first.code,
      isDay: first.isDay,
      precipMm: first.precipMm,
      cloud: 40,
      pressure: 1010,
      windKmh: first.windKmh,
      windDir: 225,
      gustKmh: first.gustKmh,
    },
    hourly,
    daily,
    air: {
      aqi: 92,
      pm25: 31,
      pm10: 58,
      o3: 64,
      no2: 22,
      so2: 9,
      co: 420,
      hourly: hourly.slice(0, 48).map((h, i) => ({ time: h.time, aqi: 80 + (i % 12) * 3 })),
    },
  };
}

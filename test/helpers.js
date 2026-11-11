import { mergePrefs } from '../public/js/store.js';

export const THRESHOLDS = { rain: 60, heat: 40, wind: 45, aqi: 150 };

const pad = (n) => String(n).padStart(2, '0');

// A calm, dry, mild forecast starting 2026-11-05 at `startHour`. Tests override
// only what they care about, through `hour` (called per hour) or `overrides`.
export function makeWeather({ startHour = 6, hour = () => ({}), overrides = {} } = {}) {
  const hourly = Array.from({ length: 72 }, (_, i) => {
    const total = startHour + i;
    const day = 5 + Math.floor(total / 24);
    const h = total % 24;
    const base = {
      time: `2026-11-${pad(day)}T${pad(h)}:00`,
      temp: 25,
      feels: 25,
      pop: 0,
      precipMm: 0,
      code: 1,
      isDay: h >= 6 && h < 18,
      windKmh: 8,
      gustKmh: 14,
      uv: 3,
      visibility: 10000,
      soil: 0.2,
      soilTemp: 24,
      humidity: 55,
      cloud: 20,
    };
    return { ...base, ...hour(base, i) };
  });

  const daily = Array.from({ length: 8 }, (_, i) => ({
    date: `2026-11-${pad(5 + i)}`,
    code: 1,
    max: 30,
    min: 20,
    pop: 10,
    precipMm: 0,
    sunrise: `2026-11-${pad(5 + i)}T06:10`,
    sunset: `2026-11-${pad(5 + i)}T17:50`,
    uvMax: 5,
    et0: 1,
    windMax: 14,
  }));

  return {
    source: 'test',
    fetchedAt: 0,
    current: {
      time: `2026-11-05T${pad(startHour)}:30`,
      temp: 25,
      feels: 25,
      humidity: 50,
      code: 1,
      isDay: true,
      precipMm: 0,
      cloud: 20,
      pressure: 1012,
      windKmh: 8,
      windDir: 90,
      gustKmh: 14,
    },
    hourly,
    daily,
    air: { aqi: 40, pm25: 10, pm10: 20 },
    ...overrides,
  };
}

export const makePrefs = (overrides = {}) => mergePrefs({ onboarded: true, ...overrides });

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalize } from '../public/js/api.js';
import { demoForecast } from '../public/js/demo.js';
import {
  addDays, aqiBand, compassPoint, esc, fmtHour, fmtTemp, fmtWind, formatParams, uvBand,
} from '../public/js/format.js';
import { STRINGS, createT } from '../public/js/i18n.js';
import { loadPrefs, mergePrefs, saveForecast, readForecast, savePrefs } from '../public/js/store.js';
import { describeCode } from '../public/js/weather-codes.js';

const fakeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
};

function rawForecast() {
  const times = ['2026-11-05T00:00', '2026-11-05T01:00', '2026-11-05T02:00', '2026-11-05T03:00'];
  const series = (value) => times.map(() => value);
  return {
    current: {
      time: '2026-11-05T02:15', temperature_2m: 21.7, apparent_temperature: 24.5,
      relative_humidity_2m: 91, weather_code: 3, is_day: 0, precipitation: 0, cloud_cover: 100,
      pressure_msl: 1015.5, wind_speed_10m: 7.5, wind_direction_10m: 70, wind_gusts_10m: 20.2,
    },
    hourly: {
      time: times,
      temperature_2m: [20, 21, 22, 23],
      apparent_temperature: series(24),
      precipitation_probability: [1, 2, null, 4],
      precipitation: series(0),
      weather_code: series(3),
      is_day: series(0),
      wind_speed_10m: series(7),
      wind_gusts_10m: series(20),
      uv_index: series(null),
      visibility: series(null),
      soil_moisture_3_to_9cm: series(0.086),
    },
    daily: {
      time: ['2026-11-05'],
      weather_code: [3],
      temperature_2m_max: [29],
      temperature_2m_min: [20],
      precipitation_sum: [1.2],
      precipitation_probability_max: [null],
      sunrise: ['2026-11-05T06:13'],
      sunset: ['2026-11-05T17:47'],
      uv_index_max: [6.1],
      et0_fao_evapotranspiration: [3.4],
    },
  };
}

describe('normalize', () => {
  it('starts the hourly list at the current hour', () => {
    const wx = normalize(rawForecast(), null, 123);
    assert.equal(wx.hourly[0].time, '2026-11-05T02:00');
    assert.equal(wx.hourly[0].temp, 22);
    assert.equal(wx.hourly.length, 2);
    assert.equal(wx.fetchedAt, 123);
  });

  it('starts the air forecast at the current hour too', () => {
    const air = {
      current: { us_aqi: 50, pm2_5: 1, pm10: 1 },
      hourly: { time: ['2026-11-05T01:00', '2026-11-05T02:00', '2026-11-05T03:00'], us_aqi: [10, 20, null] },
    };
    assert.deepEqual(normalize(rawForecast(), air).air.hourly, [{ time: '2026-11-05T02:00', aqi: 20 }]);
  });

  it('turns missing numbers into safe values', () => {
    const wx = normalize(rawForecast(), null);
    assert.equal(wx.hourly[0].pop, 0);
    assert.equal(wx.hourly[0].uv, 0);
    assert.equal(wx.hourly[0].visibility, null);
    assert.equal(wx.daily[0].pop, 0);
  });

  it('keeps air quality when present and tolerates its absence', () => {
    const air = { current: { us_aqi: 47, pm2_5: 10.1, pm10: 10.2 } };
    const result = normalize(rawForecast(), air).air;
    assert.equal(result.aqi, 47);
    assert.equal(result.pm25, 10.1);
    assert.deepEqual(result.hourly, []);
    assert.equal(normalize(rawForecast(), null).air, null);
    assert.equal(normalize(rawForecast(), { current: { us_aqi: null } }).air, null);
  });
});

describe('demoForecast', () => {
  it('matches the live data shape and is marked as sample data', () => {
    const wx = demoForecast(new Date(2026, 10, 5, 14, 30));
    assert.equal(wx.source, 'demo');
    assert.equal(wx.hourly[0].time, '2026-11-05T14:00');
    assert.equal(wx.daily.length, 14);
    const liveKeys = Object.keys(normalize(rawForecast(), null).hourly[0]).sort();
    assert.deepEqual(Object.keys(wx.hourly[0]).sort(), liveKeys);
  });
});

describe('format', () => {
  it('does not shift times with the device time zone', () => {
    assert.match(fmtHour('2026-11-05T16:00', 'en'), /^4\s*pm$/i);
  });

  it('crosses month ends', () => {
    assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  });

  it('converts units', () => {
    assert.equal(fmtTemp(30, 'c'), '30°');
    assert.equal(fmtTemp(30, 'f'), '86°');
    assert.equal(fmtWind(100, 'kmh'), '100 km/h');
    assert.equal(fmtWind(100, 'mph'), '62 mph');
  });

  it('maps bands at their edges', () => {
    assert.equal(aqiBand(50), 'good');
    assert.equal(aqiBand(51), 'moderate');
    assert.equal(aqiBand(301), 'hazardous');
    assert.equal(uvBand(2.9), 'low');
    assert.equal(uvBand(11), 'extreme');
  });

  it('wraps compass points', () => {
    assert.equal(compassPoint(0), 'N');
    assert.equal(compassPoint(350), 'N');
    assert.equal(compassPoint(225), 'SW');
  });

  it('escapes HTML', () => {
    assert.equal(esc('<b a="1">&\''), '&lt;b a=&quot;1&quot;&gt;&amp;&#39;');
  });

  it('formats params by naming convention', () => {
    const t = createT('en');
    const out = formatParams(
      { rainAt: '2026-11-05T16:00', day: '2026-11-06', peakTemp: 41.6, gustWind: 50, pop: 70, slot: 'morning', cond: 'rain' },
      { t, lang: 'en', units: { temp: 'c', wind: 'kmh' }, today: '2026-11-05' },
    );
    assert.match(out.rainAt, /^4\s*pm$/i);
    assert.equal(out.day, 'tomorrow');
    assert.equal(out.peakTemp, '42°');
    assert.equal(out.gustWind, '50 km/h');
    assert.equal(out.pop, 70);
    assert.equal(out.slot, 'morning commute');
    assert.equal(out.cond, 'Rain');
  });
});

describe('weather codes', () => {
  it('uses night icons after dark', () => {
    assert.equal(describeCode(0, true).icon, 'sun');
    assert.equal(describeCode(0, false).icon, 'moon');
    assert.equal(describeCode(2, false).icon, 'partlyNight');
    assert.equal(describeCode(95, false).sky, 'storm-night');
  });

  it('has a fallback for unknown codes', () => {
    assert.equal(describeCode(999).key, 'unknown');
  });

  it('has text for every condition', () => {
    for (const code of [0, 1, 2, 3, 45, 51, 61, 65, 71, 95, 999]) {
      assert.ok(STRINGS.en[`wx.${describeCode(code).key}`], `code ${code}`);
    }
  });
});

describe('translations', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('defines the same keys in English and Hindi', () => {
    assert.deepEqual(Object.keys(STRINGS.hi).sort(), Object.keys(STRINGS.en).sort());
  });

  it('uses the same placeholders in both languages', () => {
    for (const [key, text] of Object.entries(STRINGS.en)) {
      assert.deepEqual(placeholders(STRINGS.hi[key]), placeholders(text), key);
    }
  });

  it('fills placeholders and shows the key if text is missing', () => {
    const t = createT('en');
    assert.equal(t('hero.feels', { temp: '30°' }), 'Feels like 30°');
    assert.equal(t('no.such.key'), 'no.such.key');
  });
});

describe('store', () => {
  it('fills in defaults for older saved data', () => {
    const prefs = mergePrefs({ name: 'Asha', thresholds: { rain: 80 } });
    assert.equal(prefs.name, 'Asha');
    assert.equal(prefs.thresholds.rain, 80);
    assert.equal(prefs.thresholds.heat, 40);
    assert.deepEqual(prefs.units, { temp: 'c', wind: 'kmh' });
  });

  it('recovers from corrupt saved data', () => {
    const prefs = loadPrefs(fakeStorage({ 'mausam.prefs.v1': '{not json' }));
    assert.equal(prefs.onboarded, false);
  });

  it('round-trips prefs and forecasts', () => {
    const storage = fakeStorage();
    savePrefs({ ...mergePrefs(null), name: 'Ravi' }, storage);
    assert.equal(loadPrefs(storage).name, 'Ravi');
    saveForecast('17.39,78.49', { source: 'x' }, storage);
    assert.deepEqual(readForecast('17.39,78.49', storage), { source: 'x' });
  });

  it('works when storage is unavailable', () => {
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    assert.doesNotThrow(() => savePrefs(mergePrefs(null), broken));
    assert.equal(loadPrefs(broken).onboarded, false);
    assert.equal(readForecast('x', broken), null);
  });
});

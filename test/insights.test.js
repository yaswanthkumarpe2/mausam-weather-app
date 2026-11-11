import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAlerts, buildInsights, findWindow, nextCommute } from '../public/js/insights.js';
import { THRESHOLDS, makeWeather } from './helpers.js';

const ids = (items) => items.map((item) => item.id);
const hourNumber = (h) => Number(h.time.slice(11, 13));

describe('findWindow', () => {
  const hours = [true, false, true, true, true, false].map((ok, i) => ({ time: `t${i}`, ok }));

  it('skips runs that are too short and reports the end of the run', () => {
    assert.deepEqual(findWindow(hours, (h) => h.ok, 3), { from: 't2', to: 't5', hours: 3 });
  });

  it('returns null when no run is long enough', () => {
    assert.equal(findWindow(hours, (h) => h.ok, 4), null);
  });

  it('accepts a run that reaches the end of the horizon', () => {
    const result = findWindow(hours, () => true, 2, 3);
    assert.deepEqual(result, { from: 't0', to: 't3', hours: 3 });
  });
});

describe('nextCommute', () => {
  it('finds the evening slot and its worst conditions', () => {
    const wx = makeWeather({
      startHour: 12,
      hour: (h) => (hourNumber(h) === 18 ? { pop: 80, visibility: 700 } : {}),
    });
    const commute = nextCommute(wx.hourly);
    assert.equal(commute.slot, 'evening');
    assert.equal(commute.day, '2026-11-05');
    assert.equal(commute.maxPop, 80);
    assert.equal(commute.minVisibility, 700);
  });

  it('rolls over to tomorrow morning late at night', () => {
    const commute = nextCommute(makeWeather({ startHour: 22 }).hourly);
    assert.equal(commute.slot, 'morning');
    assert.equal(commute.day, '2026-11-06');
  });

  it('only counts the rest of a slot that is already under way', () => {
    const wx = makeWeather({ startHour: 19, hour: (h) => (hourNumber(h) === 20 ? { pop: 90 } : {}) });
    assert.equal(nextCommute(wx.hourly).maxPop, 0);
  });
});

describe('buildInsights', () => {
  it('gives each interest its own advice', () => {
    const wx = makeWeather();
    assert.ok(ids(buildInsights(wx, ['farmer'], THRESHOLDS)).includes('sprayWindow'));
    assert.ok(ids(buildInsights(wx, ['commuter'], THRESHOLDS)).includes('commuteDry'));
    assert.ok(ids(buildInsights(wx, ['outdoor'], THRESHOLDS)).includes('outdoorWindow'));
    assert.ok(ids(buildInsights(wx, ['health'], THRESHOLDS)).includes('aqiFine'));
    assert.ok(ids(buildInsights(wx, ['traveller'], THRESHOLDS)).includes('driestDay'));
  });

  it('falls back to a general summary with no interests', () => {
    assert.deepEqual(ids(buildInsights(makeWeather(), [], THRESHOLDS)), ['today']);
  });

  it('tells farmers to water when loss outpaces rain', () => {
    const wx = makeWeather();
    wx.daily.forEach((d) => { d.et0 = 5; });
    const irrigate = buildInsights(wx, ['farmer'], THRESHOLDS).find((i) => i.id === 'irrigate');
    assert.deepEqual(irrigate.params, { mm: 0, loss: 15 });
  });

  it('warns farmers about heavy rain instead of suggesting irrigation', () => {
    const wx = makeWeather();
    wx.daily.forEach((d) => { d.precipMm = 15; d.et0 = 5; });
    const result = ids(buildInsights(wx, ['farmer'], THRESHOLDS));
    assert.ok(result.includes('farmHeavyRain'));
    assert.ok(!result.includes('irrigate'));
  });

  it('reports no spray window when it is windy all the time', () => {
    const wx = makeWeather({ hour: () => ({ windKmh: 25 }) });
    assert.ok(ids(buildInsights(wx, ['farmer'], THRESHOLDS)).includes('noSpray'));
  });

  it('puts fog ahead of rain for commuters', () => {
    const wx = makeWeather({ hour: () => ({ visibility: 500, pop: 90 }) });
    const result = ids(buildInsights(wx, ['commuter'], THRESHOLDS));
    assert.ok(result.includes('commuteFog'));
    assert.ok(!result.includes('commuteWet'));
  });

  it('says a shared point once when two interests raise it', () => {
    const wx = makeWeather();
    wx.daily[0].uvMax = 10;
    const result = ids(buildInsights(wx, ['outdoor', 'health'], THRESHOLDS));
    assert.equal(result.filter((id) => id === 'uvHigh').length, 1);
  });

  it('sorts the most serious items first', () => {
    const wx = makeWeather({ overrides: { air: { aqi: 220, pm25: 90, pm10: 120 } } });
    assert.equal(buildInsights(wx, ['traveller', 'health'], THRESHOLDS)[0].id, 'aqiHigh');
  });

  it('still works when air quality is unavailable', () => {
    const wx = makeWeather({ overrides: { air: null } });
    assert.doesNotThrow(() => buildInsights(wx, ['health', 'outdoor'], THRESHOLDS));
  });
});

describe('buildAlerts', () => {
  it('stays quiet on a calm day', () => {
    assert.deepEqual(buildAlerts(makeWeather(), THRESHOLDS), []);
  });

  it('respects the user’s own thresholds', () => {
    const wx = makeWeather({ hour: () => ({ pop: 50 }) });
    assert.deepEqual(buildAlerts(wx, THRESHOLDS), []);
    assert.deepEqual(ids(buildAlerts(wx, { ...THRESHOLDS, rain: 50 })), ['rain']);
  });

  it('raises rain to a warning when the total is high', () => {
    const wx = makeWeather({ hour: () => ({ pop: 90, precipMm: 3 }) });
    assert.equal(buildAlerts(wx, THRESHOLDS)[0].severity, 'warn');
  });

  it('reports a thunderstorm instead of plain rain', () => {
    const wx = makeWeather({ hour: (h, i) => (i === 2 ? { code: 95, pop: 90 } : {}) });
    assert.deepEqual(ids(buildAlerts(wx, THRESHOLDS)), ['storm']);
  });

  it('covers heat, wind and air together', () => {
    const wx = makeWeather({
      hour: () => ({ feels: 44, gustKmh: 60 }),
      overrides: { air: { aqi: 200, pm25: 80, pm10: 100 } },
    });
    assert.deepEqual(ids(buildAlerts(wx, THRESHOLDS)), ['heat', 'wind', 'aqi']);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkIn, earnedBadges, EMPTY_STATS, logAlerts } from '../public/js/achievements.js';
import { daylightMinutes, goldenHourStart, moonPhase } from '../public/js/astro.js';
import { lineChart, pairedBars, ring, smoothPath } from '../public/js/charts.js';
import { compareLastYear, lastDate, monsoonCompare, sameDayHistory } from '../public/js/climate.js';
import {
  cropById, cropRisks, dryWindow, growingDegreeDays, sprayCalendar, waterBalance,
} from '../public/js/farm.js';
import {
  bestOutdoorHour, conditionAdvice, heatBand, heatIndex, mainPollutant, pollutantLevels, safeHours, uvWindow,
} from '../public/js/health.js';
import {
  ACTIVITIES, PLAN_ACTIVITIES, dayParts, discomfort, headline, levelOf, rankDays, rateActivities, scoreHour, wearAdvice,
} from '../public/js/lifestyle.js';
import {
  addHours, assessTrip, bestDeparture, distanceKm, riskOf, roadEstimate, waypoints,
} from '../public/js/trip.js';
import { skyFor } from '../public/js/weather-codes.js';
import { THRESHOLDS, makeWeather } from './helpers.js';

const hourNumber = (h) => Number(h.time.slice(11, 13));
const activity = (id) => ACTIVITIES.find((a) => a.id === id);

describe('lifestyle: activities', () => {
  const noon = makeWeather({ startHour: 10 }).hourly[0];

  it('rates a mild dry day highly and rain poorly', () => {
    assert.ok(scoreHour(activity('walking'), noon) >= 90);
    assert.ok(scoreHour(activity('walking'), { ...noon, pop: 90 }) < 40);
  });

  it('does not allow daylight activities at night, or stargazing by day', () => {
    assert.equal(scoreHour(activity('cricket'), { ...noon, isDay: false }), 0);
    assert.equal(scoreHour(activity('stargazing'), noon), 0);
    assert.ok(scoreHour(activity('stargazing'), { ...noon, isDay: false, cloud: 5 }) > 80);
  });

  it('needs wind for kites and dry air for laundry', () => {
    assert.ok(scoreHour(activity('kite'), { ...noon, windKmh: 2 }) < scoreHour(activity('kite'), { ...noon, windKmh: 18 }));
    assert.ok(scoreHour(activity('laundry'), { ...noon, humidity: 95 }) < scoreHour(activity('laundry'), { ...noon, humidity: 40 }));
  });

  it('penalises exertion more than rest in bad air', () => {
    const drop = (id) => scoreHour(activity(id), noon) - scoreHour(activity(id), noon, 220);
    assert.ok(drop('running') > drop('walking'));
  });

  it('sorts activities best first and gives each a best time', () => {
    const rated = rateActivities(makeWeather());
    assert.equal(rated.length, ACTIVITIES.length);
    assert.ok(rated[0].score >= rated.at(-1).score);
    assert.ok(rated[0].time);
  });

  it('maps scores to levels', () => {
    assert.deepEqual([90, 70, 40, 10].map(levelOf), ['great', 'good', 'fair', 'poor']);
  });
});

describe('lifestyle: best day', () => {
  it('prefers the dry day', () => {
    const wx = makeWeather({ startHour: 0, hour: (h) => (h.time.startsWith('2026-11-05') ? { pop: 90 } : {}) });
    wx.daily[0].precipMm = 25;
    const { best, days } = rankDays(wx, PLAN_ACTIVITIES[0]);
    assert.notEqual(best.date, '2026-11-05');
    assert.ok(days[0].score < best.score);
  });

  it('marks down a stormy day even if some hours look dry', () => {
    const wx = makeWeather({ startHour: 0 });
    wx.daily[1].code = 95;
    wx.daily[1].pop = 92;
    const { days } = rankDays(wx, PLAN_ACTIVITIES[0]);
    assert.ok(days[1].score < 65);
    assert.ok(days[2].score > days[1].score + 30);
  });

  it('skips days with too little hourly data', () => {
    const { days } = rankDays(makeWeather({ startHour: 22 }), PLAN_ACTIVITIES[0]);
    assert.ok(!days.some((d) => d.date === '2026-11-05'));
  });
});

describe('lifestyle: wear advice', () => {
  const ids = (wx) => wearAdvice(wx).map((item) => item.id);

  it('suggests an umbrella for rain and a raincoat for wind and rain', () => {
    assert.ok(ids(makeWeather({ hour: () => ({ pop: 50 }) })).includes('umbrella'));
    assert.ok(ids(makeWeather({ hour: () => ({ pop: 80, windKmh: 30 }) })).includes('raincoat'));
  });

  it('suits the temperature', () => {
    assert.ok(ids(makeWeather({ hour: () => ({ feels: 36 }) })).includes('cotton'));
    assert.ok(ids(makeWeather({ hour: () => ({ feels: 36 }) })).includes('water'));
    assert.ok(ids(makeWeather({ hour: () => ({ feels: 8 }) })).includes('jacket'));
  });

  it('adds sun and air protection when needed', () => {
    assert.ok(ids(makeWeather({ hour: () => ({ uv: 9 }) })).includes('hat'));
    assert.ok(ids(makeWeather({ overrides: { air: { aqi: 200 } } })).includes('mask'));
  });
});

describe('lifestyle: day parts and headline', () => {
  it('names parts in the order they occur', () => {
    assert.deepEqual(dayParts(makeWeather({ startHour: 13 })).map((p) => p.id), ['afternoon', 'evening', 'night', 'morning']);
  });

  it('treats hours after midnight as night', () => {
    assert.equal(dayParts(makeWeather({ startHour: 2 }))[0].id, 'night');
  });

  it('leads with the most important message', () => {
    const storm = makeWeather({ hour: (h, i) => (i === 3 ? { code: 95 } : {}) });
    assert.equal(headline(storm, THRESHOLDS).key, 'head.storm');
    const soon = makeWeather({ hour: (h, i) => (i === 4 ? { pop: 80 } : {}) });
    assert.equal(headline(soon, THRESHOLDS).key, 'head.rainSoon');
    const easing = makeWeather({ hour: (h, i) => (i < 3 ? { pop: 90, precipMm: 2 } : {}) });
    assert.equal(headline(easing, THRESHOLDS).key, 'head.rainStops');
    assert.equal(headline(makeWeather(), THRESHOLDS).key, 'head.calm');
  });
});

describe('lifestyle: comparing places', () => {
  it('does not call a place comfortable when its air is bad', () => {
    const mild = (aqi) => {
      const wx = makeWeather({ overrides: { air: { aqi } } });
      wx.current.feels = 24;
      return wx;
    };
    const warmButClean = makeWeather({ overrides: { air: { aqi: 49 } } });
    warmButClean.current.feels = 29;
    assert.ok(discomfort(warmButClean) < discomfort(mild(209)));
    assert.ok(discomfort(mild(40)) < discomfort(warmButClean));
  });
});

describe('astro', () => {
  it('finds known moon phases', () => {
    assert.equal(moonPhase('2024-04-08').name, 'new');
    assert.equal(moonPhase('2024-04-23').name, 'full');
    assert.ok(moonPhase('2024-04-23').illumination > 95);
  });

  it('works out daylight and golden hour', () => {
    assert.equal(daylightMinutes('2026-11-05T06:10', '2026-11-05T17:40'), 690);
    assert.equal(goldenHourStart('2026-11-05T17:40'), '2026-11-05T16:40');
  });
});

describe('sky', () => {
  it('uses a golden sky near sunset on a clear day only', () => {
    const wx = makeWeather({ startHour: 17 });
    wx.current.time = '2026-11-05T17:40';
    wx.current.code = 0;
    assert.equal(skyFor(wx), 'golden');
    wx.current.code = 63;
    assert.equal(skyFor(wx), 'rain-day');
  });
});

describe('farm', () => {
  const rice = cropById('rice');

  it('falls back to the first crop for an unknown id', () => {
    assert.equal(cropById('nothing').id, 'rice');
  });

  it('calculates need from crop coefficient and water loss', () => {
    const wx = makeWeather();
    wx.daily.forEach((d) => { d.et0 = 5; });
    const plan = waterBalance(wx.daily, rice, 'mid');
    assert.equal(plan.rows.length, 7);
    assert.equal(plan.need, 42);
    assert.equal(plan.irrigate, 42);
    assert.equal(plan.status, 'deficit');
  });

  it('counts only part of the rain, and spots surplus', () => {
    const wx = makeWeather();
    wx.daily.forEach((d) => { d.et0 = 1; d.precipMm = 10; });
    const plan = waterBalance(wx.daily, rice, 'mid');
    assert.equal(plan.irrigate, 0);
    assert.equal(plan.status, 'surplus');
  });

  it('rates spray slots from calm and dry to avoid', () => {
    const wx = makeWeather({ startHour: 0 });
    assert.equal(sprayCalendar(wx.hourly)[0].slots[0].rating, 'good');
    const wet = makeWeather({ startHour: 0, hour: () => ({ pop: 80 }) });
    assert.equal(sprayCalendar(wet.hourly)[0].slots[0].rating, 'bad');
  });

  it('marks rain just after a slot as a reason not to spray', () => {
    const wx = makeWeather({ startHour: 0, hour: (h) => (hourNumber(h) === 10 ? { pop: 90 } : {}) });
    assert.equal(sprayCalendar(wx.hourly)[0].slots[0].rating, 'bad');
  });

  it('marks slots that have already passed', () => {
    assert.equal(sprayCalendar(makeWeather({ startHour: 16 }).hourly)[0].slots[0].rating, 'past');
  });

  it('raises crop-specific risks', () => {
    const hot = makeWeather();
    hot.daily[1].max = 39;
    const ids = (wx, crop) => cropRisks(wx, crop).map((r) => r.id);
    assert.ok(ids(hot, rice).includes('heat'));
    assert.ok(!ids(hot, cropById('cotton')).includes('heat'));

    const damp = makeWeather({ hour: () => ({ humidity: 92 }) });
    assert.ok(ids(damp, rice).includes('fungal'));

    const flood = makeWeather();
    flood.daily[0].precipMm = 70;
    assert.ok(ids(flood, rice).includes('flood'));
    assert.deepEqual(ids(makeWeather({ hour: () => ({ humidity: 40 }) }), cropById('cotton')), []);
  });

  it('adds up growing degree days and finds dry spells', () => {
    const wx = makeWeather();
    assert.equal(growingDegreeDays(wx.daily), 105);
    wx.daily[2].pop = 80;
    assert.deepEqual(dryWindow(wx.daily), { from: '2026-11-08', to: '2026-11-12', length: 5 });
  });
});

describe('health', () => {
  it('compares pollutants with their guideline', () => {
    const air = { pm25: 45, pm10: 20, o3: null, no2: 10, so2: 5, co: 300 };
    const levels = pollutantLevels(air);
    assert.equal(levels.length, 5);
    assert.equal(levels[0].level, 'warn');
    assert.equal(mainPollutant(air).id, 'pm25');
  });

  it('raises the heat index in humid heat only', () => {
    assert.equal(heatIndex(22, 90), 22);
    assert.ok(heatIndex(35, 80) > 45);
    assert.equal(heatBand(heatIndex(35, 60)), 'danger');
    assert.equal(heatBand(heatIndex(35, 80)), 'extremeDanger');
  });

  it('is stricter for sensitive people', () => {
    const wx = makeWeather({ overrides: { air: { aqi: 110, hourly: [] } } });
    assert.equal(safeHours(wx, [])[0].status, 'caution');
    assert.equal(safeHours(wx, ['asthma'])[0].status, 'caution');
    wx.air.aqi = 130;
    assert.equal(safeHours(wx, [])[0].status, 'caution');
    assert.equal(safeHours(wx, ['asthma'])[0].status, 'avoid');
  });

  it('uses the forecast air quality for each hour', () => {
    const wx = makeWeather();
    wx.air = { aqi: 40, hourly: [{ time: wx.hourly[3].time, aqi: 220 }] };
    const slots = safeHours(wx, []);
    assert.equal(slots[0].status, 'good');
    assert.equal(slots[3].status, 'avoid');
  });

  it('finds the longest safe stretch in waking hours', () => {
    const slots = [
      { time: '2026-11-05T03:00', status: 'good' },
      { time: '2026-11-05T06:00', status: 'good' },
      { time: '2026-11-05T07:00', status: 'good' },
      { time: '2026-11-05T08:00', status: 'avoid' },
      { time: '2026-11-05T09:00', status: 'good' },
    ];
    assert.deepEqual(bestOutdoorHour(slots), { from: '2026-11-05T06:00', to: '2026-11-05T08:00', hours: 2 });
    assert.equal(bestOutdoorHour([{ time: '2026-11-05T09:00', status: 'avoid' }]), null);
  });

  it('finds when sun protection is needed', () => {
    const wx = makeWeather({ startHour: 6, hour: (h) => ({ uv: hourNumber(h) >= 10 && hourNumber(h) <= 14 ? 6 : 1 }) });
    assert.deepEqual(uvWindow(wx.hourly), { from: '2026-11-05T10:00', to: '2026-11-05T14:00' });
    assert.equal(uvWindow(makeWeather({ hour: () => ({ uv: 1 }) }).hourly), null);
  });

  it('tailors advice to the conditions chosen', () => {
    const wx = makeWeather({ hour: () => ({ feels: 38 }), overrides: { air: { aqi: 160 } } });
    const ids = (conditions) => conditionAdvice(wx, conditions).map((tip) => tip.id);
    assert.ok(ids(['asthma']).includes('asthmaAir'));
    assert.ok(ids(['heart']).includes('heartHeat'));
    assert.ok(ids(['elderly']).includes('elderlyHeat'));
    assert.ok(ids(['children']).includes('childrenPlay'));
    assert.deepEqual(conditionAdvice(makeWeather(), []).map((tip) => tip.id), ['allClear']);
  });
});

function archive() {
  const time = [];
  const max = [];
  const min = [];
  const rain = [];
  for (const year of [2025, 2026]) {
    const start = Date.UTC(year, 5, 1);
    const days = year === 2025 ? 214 : 150;
    for (let i = 0; i < days; i++) {
      time.push(new Date(start + i * 864e5).toISOString().slice(0, 10));
      max.push(year === 2026 ? 32 : 30);
      min.push(22);
      rain.push(year === 2026 ? 6 : 4);
    }
  }
  return { time, max, min, rain };
}

describe('climate', () => {
  it('finds the last date with data', () => {
    assert.equal(lastDate({ time: ['a', 'b'], max: [1, null] }), 'a');
  });

  it('compares the last 30 days with last year', () => {
    const result = compareLastYear(archive());
    assert.equal(result.warmer, 2);
    assert.equal(result.thisYear.rain, 180);
    assert.equal(result.lastYear.rain, 120);
    assert.equal(result.rows.length, 30);
  });

  it('tracks monsoon rain to the same point in both years', () => {
    const result = monsoonCompare(archive());
    assert.equal(result.year, 2026);
    assert.equal(result.total, 122 * 6);
    assert.equal(result.lastTotal, 122 * 4);
    assert.equal(result.change, 50);
    assert.equal(result.finished, true);
  });

  it('lists the same date across years', () => {
    const rows = sameDayHistory(archive());
    assert.equal(rows.length, 2);
    assert.equal(rows[0].max, 32);
  });

  it('copes with empty history', () => {
    const empty = { time: [], max: [], min: [], rain: [] };
    assert.equal(compareLastYear(empty), null);
    assert.equal(monsoonCompare(empty), null);
    assert.deepEqual(sameDayHistory(empty), []);
  });
});

describe('trip', () => {
  const delhi = { lat: 28.61, lon: 77.21 };
  const mumbai = { lat: 19.08, lon: 72.88 };

  const hours = (overrides = () => ({})) => Array.from({ length: 96 }, (_, i) => ({
    time: addHours('2026-11-05T00:00', i),
    pop: 0,
    precipMm: 0,
    code: 1,
    windKmh: 8,
    visibility: 10000,
    ...overrides(i),
  }));

  it('measures distance', () => {
    assert.ok(Math.abs(distanceKm(delhi, mumbai) - 1148) < 15);
    assert.ok(roadEstimate(delhi, mumbai).km > 1148);
  });

  it('spaces waypoints along the route', () => {
    const points = waypoints(delhi, mumbai);
    assert.equal(points.length, 5);
    assert.deepEqual([points[0].lat, points[0].lon], [delhi.lat, delhi.lon]);
    assert.ok(Math.abs(points[2].lat - 23.845) < 0.01);
  });

  it('adds hours across midnight and month end', () => {
    assert.equal(addHours('2026-11-30T22:00', 5), '2026-12-01T03:00');
  });

  it('scores risk from rain, storms and fog', () => {
    assert.equal(riskOf(hours()[0]), 0);
    assert.equal(riskOf({ ...hours()[0], code: 95 }), 3);
    assert.equal(riskOf({ ...hours()[0], visibility: 500 }), 2);
    assert.equal(riskOf(null), 0);
  });

  it('reads each stop at its arrival time', () => {
    const result = assessTrip([hours(), hours(), hours()], '2026-11-05T08:00', 4);
    assert.deepEqual(result.stops.map((s) => s.eta), ['2026-11-05T08:00', '2026-11-05T10:00', '2026-11-05T12:00']);
    assert.equal(result.verdict, 'good');
  });

  it('turns a storm on the route into a bad verdict', () => {
    const stormy = hours((i) => (i === 10 ? { code: 95 } : {}));
    assert.equal(assessTrip([hours(), stormy, hours()], '2026-11-05T08:00', 4).verdict, 'bad');
  });

  it('marks a trip incomplete beyond the forecast', () => {
    assert.equal(assessTrip([hours(), hours()], '2026-11-09T08:00', 2).complete, false);
  });

  it('picks a departure that avoids the rain', () => {
    const wet = hours((i) => (i >= 8 && i <= 12 ? { pop: 90 } : {}));
    const best = bestDeparture([wet, wet], '2026-11-05T08:00', 2);
    assert.equal(best.total, 0);
    assert.equal(best.departure, '2026-11-05T13:00');
  });
});

describe('achievements', () => {
  it('counts a streak across consecutive days', () => {
    let stats = checkIn(EMPTY_STATS, '2026-11-05');
    stats = checkIn(stats, '2026-11-06');
    stats = checkIn(stats, '2026-11-07');
    assert.equal(stats.streak, 3);
    assert.equal(stats.best, 3);
    assert.ok(earnedBadges(stats).includes('streak3'));
  });

  it('counts one visit per day and resets after a gap', () => {
    const first = checkIn(EMPTY_STATS, '2026-11-05');
    assert.equal(checkIn(first, '2026-11-05'), first);
    const later = checkIn(first, '2026-11-09');
    assert.equal(later.streak, 1);
    assert.equal(later.best, 1);
  });

  it('logs each alert once per place and day', () => {
    const alerts = [{ id: 'rain', severity: 'watch', icon: 'rain', params: {} }];
    const first = logAlerts([], alerts, 'Guntur', '2026-11-05');
    assert.equal(first.fresh.length, 1);
    const again = logAlerts(first.log, alerts, 'Guntur', '2026-11-05');
    assert.equal(again.fresh.length, 0);
    assert.equal(again.log.length, 1);
    assert.equal(logAlerts(first.log, alerts, 'Delhi', '2026-11-05').fresh.length, 1);
  });
});

describe('charts', () => {
  it('draws a smooth path through every point', () => {
    const path = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
    assert.ok(path.startsWith('M0.0 0.0'));
    assert.equal((path.match(/C/g) ?? []).length, 2);
    assert.equal(smoothPath([{ x: 0, y: 0 }]), '');
  });

  it('copes with flat, empty and gappy data', () => {
    assert.ok(!lineChart({ id: 'a', series: [{ values: [5, 5, 5], color: 'red' }] }).includes('NaN'));
    assert.equal(lineChart({ id: 'b', series: [{ values: [], color: 'red' }] }), '');
    assert.ok(!lineChart({ id: 'c', series: [{ values: [1, null, 3], color: 'red' }] }).includes('NaN'));
  });

  it('draws bars for zero rain without errors', () => {
    const svg = pairedBars({ groups: [{ label: 'Mon', a: 0, b: 0 }], colorA: 'red', colorB: 'blue' });
    assert.ok(!svg.includes('NaN'));
  });

  it('caps a ring at its maximum', () => {
    assert.ok(ring({ value: 500, max: 300, label: '500' }).includes('500'));
  });
});

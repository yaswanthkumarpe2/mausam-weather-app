import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ageLabel, briefingText, fillContext, greetingKey, renderDaySheet, renderHome, renderShareData } from '../public/js/cards.js';
import { demoForecast } from '../public/js/demo.js';
import { createT } from '../public/js/i18n.js';
import { renderAlertsSheet, renderCommunity, renderReportSheet } from '../public/js/screen-community.js';
import { renderFarm } from '../public/js/screen-farm.js';
import { renderHealth } from '../public/js/screen-health.js';
import { renderPlan } from '../public/js/screen-plan.js';
import { renderOnboarding, renderPlaceResults, renderSheet } from '../public/js/sheets.js';
import { makePrefs, makeWeather } from './helpers.js';

const PLACE = { id: '17.39,78.49', name: 'Hyderabad', lat: 17.39, lon: 78.49 };
const ALL_PERSONAS = ['farmer', 'commuter', 'outdoor', 'health', 'traveller'];

function context(wx, prefOverrides = {}, status = 'live') {
  const prefs = makePrefs({ locations: [PLACE], activeLocationId: PLACE.id, ...prefOverrides });
  return fillContext({
    t: createT(prefs.lang),
    lang: prefs.lang,
    units: prefs.units,
    prefs,
    wx,
    status,
    ui: { metric: 'temp', allDays: false, planSegment: 'best', planActivity: 'event' },
    reports: { list: [], loading: false, failed: false },
    draft: { type: null, note: '', posting: false, message: '' },
    trip: { to: null, date: null, hour: 8, loading: false, failed: false, needsTo: false, result: null },
    compare: { loading: false, data: {} },
    climate: { loading: false, failed: false, archive: null },
    location: PLACE,
  });
}

describe('renderHome', () => {
  it('renders every card in both languages with no unfilled text', () => {
    for (const lang of ['en', 'hi']) {
      const html = renderHome(context(makeWeather(), { lang, personas: ALL_PERSONAS }), PLACE);
      for (const id of ['forYou', 'wear', 'hourly', 'daily', 'activities', 'rain', 'air', 'community', 'sun', 'moon', 'wind', 'details', 'farm']) {
        assert.ok(html.includes(`data-card="${id}"`), `${lang}: ${id}`);
      }
      assert.ok(!html.includes('undefined') && !html.includes('NaN'), lang);
      assert.doesNotMatch(html, /\{\w+\}/, lang);
    }
  });

  it('renders sample data without errors', () => {
    const html = renderHome(context(demoForecast(), { personas: ALL_PERSONAS }, 'demo'), PLACE);
    assert.ok(html.includes('not a real forecast'));
  });

  it('shows a loading state before data arrives', () => {
    assert.ok(renderHome(context(null), PLACE).includes('Fetching the forecast'));
  });

  it('escapes the user’s name and place names', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const html = renderHome(
      context(makeWeather(), { name: evil, locations: [{ ...PLACE, name: evil }, { id: 'b', name: 'B' }] }),
      { ...PLACE, name: evil },
    );
    assert.ok(!html.includes('<img'));
  });

  it('labels alerts as unofficial', () => {
    const wx = makeWeather({ hour: () => ({ pop: 90 }) });
    assert.ok(renderHome(context(wx), PLACE).includes('not an official warning'));
  });

  it('gives the same rain start time in the alert and the rain card', () => {
    const wx = makeWeather({ hour: (h, i) => ({ pop: i < 2 ? 55 : 60 }) });
    const html = renderHome(context(wx), PLACE);
    assert.ok(html.includes('Rain likely from 8 am:'), 'alert');
    assert.ok(html.includes('Rain likely from 8 am</p>'), 'rain card');
  });

  it('handles missing air quality', () => {
    const wx = makeWeather({ overrides: { air: null } });
    assert.ok(renderHome(context(wx), PLACE).includes('not available right now'));
  });
});

describe('greetings and ages', () => {
  it('follows the clock at the forecast location', () => {
    assert.equal(greetingKey(5), 'greeting.morning');
    assert.equal(greetingKey(12), 'greeting.afternoon');
    assert.equal(greetingKey(17), 'greeting.evening');
    assert.equal(greetingKey(23), 'greeting.night');
    assert.equal(greetingKey(2), 'greeting.night');
  });

  it('describes how old a forecast is', () => {
    const t = createT('en');
    const now = 10 * 60 * 60 * 1000;
    assert.equal(ageLabel(now - 20000, t, now), 'just now');
    assert.equal(ageLabel(now - 5 * 60000, t, now), '5 min ago');
    assert.equal(ageLabel(now - 3 * 3600000, t, now), '3 h ago');
  });
});

describe('sheets and onboarding', () => {
  it('renders all three setup steps', () => {
    for (const step of [0, 1, 2]) {
      assert.ok(renderOnboarding(context(null), step).includes(`Step ${step + 1} of 3`));
    }
  });

  it('renders each sheet', () => {
    for (const name of ['locations', 'settings', 'customize']) {
      assert.doesNotMatch(renderSheet(name, context(makeWeather())), /undefined|\{\w+\}/, name);
    }
  });

  it('shows search states', () => {
    const t = createT('en');
    assert.ok(renderPlaceResults([], t, false).includes('No places found'));
    assert.ok(renderPlaceResults(null, t, true).includes('not available'));
    const html = renderPlaceResults([{ name: '<b>', region: 'X' }], t, false);
    assert.ok(html.includes('&lt;b&gt;'));
  });
});

const clean = (html, label) => {
  assert.ok(!html.includes('undefined') && !html.includes('NaN'), label);
  assert.doesNotMatch(html, /\{\w+\}/, label);
  assert.doesNotMatch(html, />[a-z]+\.[a-zA-Z.]+</, label); // A missing translation shows its key.
};

describe('feature screens', () => {
  const stormy = () => makeWeather({
    hour: (h, i) => ({ pop: i % 3 ? 90 : 20, windKmh: 25, humidity: 92, feels: 41, uv: 9 }),
    overrides: {
      air: { aqi: 180, pm25: 90, pm10: 120, o3: 80, no2: 40, so2: 10, co: 900, hourly: [] },
    },
  });

  it('renders every screen in both languages, in calm and rough weather', () => {
    for (const lang of ['en', 'hi']) {
      for (const wx of [makeWeather(), demoForecast(), stormy()]) {
        const ctx = context(wx, { lang, health: { conditions: ['asthma', 'heart', 'elderly', 'children'] } });
        clean(renderFarm(ctx, PLACE), `farm ${lang}`);
        clean(renderHealth(ctx, PLACE), `health ${lang}`);
        clean(renderPlan(ctx, PLACE), `plan ${lang}`);
        clean(renderCommunity(ctx, PLACE), `community ${lang}`);
        clean(renderReportSheet(ctx), `report ${lang}`);
        clean(renderAlertsSheet(ctx), `alerts ${lang}`);
      }
    }
  });

  it('shows loading screens before data arrives', () => {
    const ctx = context(null);
    for (const screen of [renderFarm, renderHealth, renderPlan]) {
      assert.ok(screen(ctx, PLACE).includes('Fetching the forecast'));
    }
  });

  it('renders each Plan segment', () => {
    const wx = makeWeather();
    for (const planSegment of ['best', 'trip', 'compare', 'climate']) {
      const ctx = context(wx);
      ctx.ui.planSegment = planSegment;
      clean(renderPlan(ctx, PLACE), planSegment);
    }
  });

  it('shows a finished trip with its verdict', () => {
    const wx = makeWeather();
    const ctx = context(wx);
    ctx.ui.planSegment = 'trip';
    ctx.trip.to = { name: 'Delhi', lat: 28.6, lon: 77.2 };
    ctx.trip.result = {
      km: 1500,
      hours: 27.3,
      names: { from: 'Guntur', to: 'Delhi' },
      best: { departure: '2026-11-05T09:00', total: 0, verdict: 'good' },
      assessment: {
        verdict: 'caution',
        stops: [
          { index: 0, eta: '2026-11-05T08:00', risk: 0, hour: wx.hourly[2] },
          { index: 1, eta: '2026-11-06T11:00', risk: 3, hour: null },
        ],
      },
    };
    const html = renderPlan(ctx, PLACE);
    clean(html, 'trip');
    assert.ok(html.includes('Travel with care'));
    assert.ok(html.includes('Arrive: Delhi'));
  });

  it('shows and escapes community reports', () => {
    const ctx = context(makeWeather());
    ctx.reports.list = [{ id: 'a', type: 'rain', note: '<b>wet</b>', name: '<i>x</i>', at: Date.now(), km: 3, confirms: 2 }];
    const html = renderCommunity(ctx, PLACE);
    clean(html, 'reports');
    assert.ok(html.includes('&lt;b&gt;wet'));
    assert.ok(!html.includes('<b>wet'));
    ctx.prefs.confirmed = ['a'];
    assert.ok(renderCommunity(ctx, PLACE).includes('disabled'));
  });

  it('explains when the community server is missing', () => {
    const ctx = context(makeWeather());
    ctx.reports.failed = true;
    assert.ok(renderCommunity(ctx, PLACE).includes('project server'));
  });

  it('opens a day in detail, and copes with a day past the hourly data', () => {
    const wx = makeWeather();
    clean(renderDaySheet(context(wx), '2026-11-06'), 'day');
    assert.ok(renderDaySheet(context(wx), '2026-11-12').includes('not available'));
  });

  it('writes a briefing and a share card in both languages', () => {
    const wx = makeWeather({ hour: () => ({ pop: 50 }) });
    for (const lang of ['en', 'hi']) {
      const ctx = context(wx, { lang, personas: ['commuter'], name: 'Asha' });
      const text = briefingText(ctx, PLACE);
      assert.ok(text.includes('Hyderabad') && text.includes('Asha'));
      assert.doesNotMatch(text, /\{\w+\}|undefined/);
      assert.ok(renderShareData(ctx, PLACE).summary.length > 5);
    }
  });

  it('switches the hourly chart to another measure', () => {
    const ctx = context(makeWeather({ hour: () => ({ humidity: 77 }) }));
    ctx.ui.metric = 'humidity';
    assert.ok(renderHome(ctx, PLACE).includes('>77%<'));
  });
});

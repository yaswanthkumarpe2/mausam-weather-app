import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CARD_IDS, rankCards } from '../public/js/personas.js';
import { makePrefs, makeWeather } from './helpers.js';

const visibleIds = (prefs, wx) => rankCards(prefs, wx).visible.map((card) => card.id);

describe('rankCards', () => {
  it('uses the same default order for anyone with no interests', () => {
    assert.deepEqual(visibleIds(makePrefs(), makeWeather()), [
      'forYou', 'hourly', 'wear', 'daily', 'activities', 'rain', 'air', 'community', 'sun', 'wind', 'moon', 'details',
    ]);
  });

  it('shows the farm card only to farmers by default', () => {
    assert.ok(!visibleIds(makePrefs(), makeWeather()).includes('farm'));
    assert.ok(visibleIds(makePrefs({ personas: ['farmer'] }), makeWeather()).includes('farm'));
  });

  it('gives different people different pages', () => {
    const wx = makeWeather();
    assert.equal(visibleIds(makePrefs({ personas: ['farmer'] }), wx)[1], 'farm');
    assert.equal(visibleIds(makePrefs({ personas: ['health'] }), wx)[1], 'air');
  });

  it('keeps For You first whatever else is selected', () => {
    const prefs = makePrefs({ personas: ['farmer', 'commuter', 'outdoor', 'health', 'traveller'] });
    assert.equal(visibleIds(prefs, makeWeather())[0], 'forYou');
  });

  it('moves the rain card up and explains why when rain is close', () => {
    const wx = makeWeather({ hour: (h, i) => (i === 3 ? { pop: 90 } : {}) });
    const { visible } = rankCards(makePrefs(), wx);
    assert.equal(visible[1].id, 'rain');
    assert.equal(visible[1].why, 'why.rain');
  });

  it('moves air quality up on a bad air day', () => {
    const wx = makeWeather({ overrides: { air: { aqi: 210, pm25: 90, pm10: 120 } } });
    const { visible } = rankCards(makePrefs(), wx);
    assert.equal(visible[1].id, 'air');
    assert.equal(visible[1].why, 'why.air');
  });

  it('lets a manual order override everything', () => {
    const order = ['wind', 'forYou', 'hourly', 'wear', 'daily', 'activities', 'rain', 'air', 'community', 'sun', 'moon', 'details', 'farm'];
    const prefs = makePrefs({ personas: ['health'], layout: { order, hidden: [] } });
    const wx = makeWeather({ hour: () => ({ pop: 90 }) });
    const { visible } = rankCards(prefs, wx);
    assert.deepEqual(visible.map((card) => card.id), order);
    assert.ok(visible.every((card) => card.why === null));
  });

  it('respects hidden cards', () => {
    const prefs = makePrefs({ layout: { order: null, hidden: ['wind', 'sun'] } });
    const result = visibleIds(prefs, makeWeather());
    assert.ok(!result.includes('wind') && !result.includes('sun'));
    assert.ok(result.includes('farm'));
  });

  it('survives a saved order that is out of date', () => {
    const prefs = makePrefs({ layout: { order: ['removedCard', 'wind'], hidden: [] } });
    const { order } = rankCards(prefs, makeWeather());
    assert.equal(order[0], 'wind');
    assert.deepEqual([...order].sort(), [...CARD_IDS].sort());
  });

  it('works before any forecast has loaded', () => {
    assert.doesNotThrow(() => rankCards(makePrefs({ personas: ['farmer'] }), null));
  });
});

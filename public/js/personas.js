// Decides which cards appear and in what order.
// Score = base + boosts from the user's interests + boosts from today's weather.
// Once the user arranges the page by hand, their order always wins.
import { hourOf } from './format.js';

export const PERSONAS = [
  { id: 'farmer', icon: 'leaf' },
  { id: 'commuter', icon: 'bus' },
  { id: 'outdoor', icon: 'run' },
  { id: 'health', icon: 'lungs' },
  { id: 'traveller', icon: 'bag' },
];

const BASE_SCORE = {
  forYou: 1000,
  hourly: 90,
  wear: 85,
  daily: 80,
  activities: 75,
  rain: 60,
  air: 50,
  community: 45,
  sun: 40,
  wind: 30,
  moon: 25,
  details: 20,
  farm: 10,
};

export const CARD_IDS = Object.keys(BASE_SCORE);

const PERSONA_BOOST = {
  farmer: { farm: 110, rain: 35, daily: 25, wind: 15 },
  commuter: { rain: 30, air: 25, hourly: 15, wear: 15 },
  outdoor: { activities: 25, sun: 45, air: 35, hourly: 15, wind: 15 },
  health: { air: 60, sun: 30, details: 20 },
  traveller: { daily: 25, rain: 10, wind: 5, wear: 10 },
};

export const defaultHidden = (personas) => (personas.includes('farmer') ? [] : ['farm']);

export const hiddenCards = (prefs) => prefs.layout.hidden ?? defaultHidden(prefs.personas);

function contextBoosts(wx, thresholds) {
  if (!wx) return [];
  const boosts = [];
  const peak = (hours, pick) => Math.max(...wx.hourly.slice(0, hours).map(pick));

  if (peak(6, (h) => h.pop) >= thresholds.rain) boosts.push({ id: 'rain', score: 60, why: 'why.rain' });
  if (wx.air && wx.air.aqi >= thresholds.aqi) boosts.push({ id: 'air', score: 80, why: 'why.air' });
  if (peak(12, (h) => h.gustKmh) >= thresholds.wind) boosts.push({ id: 'wind', score: 60, why: 'why.wind' });

  const hour = hourOf(wx.current.time);
  if (wx.daily[0].uvMax >= 8 && hour < 15) boosts.push({ id: 'sun', score: 30, why: 'why.uv' });
  if (hour >= 18) boosts.push({ id: 'daily', score: 20 }); // Evenings look ahead to tomorrow.
  return boosts;
}

export function rankCards(prefs, wx) {
  const hidden = hiddenCards(prefs);

  if (prefs.layout.order) {
    const known = prefs.layout.order.filter((id) => CARD_IDS.includes(id));
    const order = [...known, ...CARD_IDS.filter((id) => !known.includes(id))];
    return {
      order,
      visible: order.filter((id) => !hidden.includes(id)).map((id) => ({ id, why: null })),
    };
  }

  const scores = { ...BASE_SCORE };
  for (const persona of prefs.personas) {
    for (const [id, boost] of Object.entries(PERSONA_BOOST[persona] ?? {})) scores[id] += boost;
  }
  const reasons = {};
  for (const { id, score, why } of contextBoosts(wx, prefs.thresholds)) {
    scores[id] += score;
    if (why) reasons[id] = why;
  }

  const order = [...CARD_IDS].sort((a, b) => scores[b] - scores[a]);
  return {
    order,
    visible: order
      .filter((id) => !hidden.includes(id))
      .map((id) => ({ id, why: reasons[id] ?? null })),
  };
}

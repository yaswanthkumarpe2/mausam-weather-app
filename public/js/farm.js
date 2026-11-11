// Member 3: the Farm hub. Crop coefficients are approximate values based on FAO-56.
// The temperature limits are rough general figures. Everything here is planning
// guidance and the UI says so.
import { dateOf, hourOf } from './format.js';

export const CROPS = [
  { id: 'rice', kc: { early: 1.05, mid: 1.2, late: 0.9 }, heat: 38, cold: 15 },
  { id: 'wheat', kc: { early: 0.3, mid: 1.15, late: 0.4 }, heat: 32, cold: 3 },
  { id: 'cotton', kc: { early: 0.35, mid: 1.15, late: 0.7 }, heat: 40, cold: 12 },
  { id: 'maize', kc: { early: 0.3, mid: 1.2, late: 0.6 }, heat: 38, cold: 10 },
  { id: 'chilli', kc: { early: 0.6, mid: 1.05, late: 0.9 }, heat: 36, cold: 12 },
  { id: 'groundnut', kc: { early: 0.4, mid: 1.15, late: 0.6 }, heat: 38, cold: 12 },
  { id: 'sugarcane', kc: { early: 0.4, mid: 1.25, late: 0.75 }, heat: 40, cold: 10 },
  { id: 'tomato', kc: { early: 0.6, mid: 1.15, late: 0.8 }, heat: 35, cold: 10 },
];

export const STAGES = ['early', 'mid', 'late'];

export const cropById = (id) => CROPS.find((crop) => crop.id === id) ?? CROPS[0];

const EFFECTIVE_RAIN = 0.8; // Some rain runs off or evaporates before crops can use it.
const round1 = (value) => Math.round(value * 10) / 10;

export function waterBalance(daily, crop, stage, days = 7) {
  const kc = crop.kc[stage];
  const rows = daily.slice(0, days).map((day) => ({
    date: day.date,
    rain: round1(day.precipMm),
    need: round1(day.et0 * kc),
  }));
  const rain = round1(rows.reduce((total, row) => total + row.rain, 0));
  const need = round1(rows.reduce((total, row) => total + row.need, 0));
  const irrigate = Math.max(0, Math.round(need - rain * EFFECTIVE_RAIN));
  let status = 'balanced';
  if (irrigate >= 10) status = 'deficit';
  else if (rain * EFFECTIVE_RAIN > need * 1.5) status = 'surplus';
  return { rows, rain, need, irrigate, status };
}

const SLOTS = [
  { id: 'morning', from: 6, to: 10 },
  { id: 'midday', from: 10, to: 15 },
  { id: 'evening', from: 15, to: 18 },
];

// Rates spray slots for the next few days. A slot only counts as good if the rest
// of it stays calm and dry, and no rain follows soon after.
export function sprayCalendar(hourly, dayCount = 3) {
  const dates = [...new Set(hourly.map((h) => dateOf(h.time)))].slice(0, dayCount);
  return dates.map((date) => ({
    date,
    slots: SLOTS.map((slot) => {
      const inSlot = hourly.filter((h) => dateOf(h.time) === date && hourOf(h.time) >= slot.from && hourOf(h.time) < slot.to);
      if (!inSlot.length) return { id: slot.id, rating: 'past' };
      const last = hourly.indexOf(inSlot.at(-1));
      const after = hourly.slice(last + 1, last + 3);
      const pop = Math.max(...inSlot.map((h) => h.pop));
      const popAfter = Math.max(0, ...after.map((h) => h.pop));
      const wind = Math.max(...inSlot.map((h) => h.windKmh));
      let rating = 'bad';
      if (pop < 20 && popAfter < 40 && wind < 15) rating = 'good';
      else if (pop < 45 && popAfter < 70 && wind < 22) rating = 'fair';
      return { id: slot.id, rating };
    }),
  }));
}

export function cropRisks(wx, crop) {
  const risks = [];
  const next48 = wx.hourly.slice(0, 48);
  const days = wx.daily.slice(0, 5);
  const rain3 = wx.daily.slice(0, 3).reduce((total, d) => total + d.precipMm, 0);

  const hottest = Math.max(...days.map((d) => d.max));
  if (hottest >= crop.heat) risks.push({ id: 'heat', severity: 'warn', icon: 'heat', params: { peakTemp: hottest } });

  const coldest = Math.min(...days.map((d) => d.min));
  if (coldest <= crop.cold) risks.push({ id: 'cold', severity: 'warn', icon: 'heat', params: { lowTemp: coldest } });

  const dampHours = next48.filter((h) => h.humidity != null && h.humidity >= 85 && h.temp >= 18 && h.temp <= 32).length;
  if (dampHours >= 12) risks.push({ id: 'fungal', severity: 'watch', icon: 'leaf', params: { hours: dampHours } });

  if (rain3 >= 50) risks.push({ id: 'flood', severity: 'warn', icon: 'rain', params: { mm: Math.round(rain3) } });

  const gust = Math.max(...next48.map((h) => h.gustKmh));
  if (gust >= 50) risks.push({ id: 'wind', severity: 'watch', icon: 'wind', params: { gustWind: gust } });

  const soil = wx.hourly[0].soil;
  if (soil != null && soil < 0.12 && rain3 < 5) risks.push({ id: 'dry', severity: 'watch', icon: 'drop', params: {} });
  return risks;
}

// Warmth available for growth over the coming days, using a 10 °C base.
export function growingDegreeDays(daily, days = 7, base = 10) {
  return Math.round(daily.slice(0, days).reduce((total, d) => total + Math.max(0, (d.max + d.min) / 2 - base), 0));
}

// The longest dry run of days, useful for harvesting or sowing.
export function dryWindow(daily, days = 10) {
  let best = null;
  let start = -1;
  const list = daily.slice(0, days);
  for (let i = 0; i <= list.length; i++) {
    const dry = i < list.length && list[i].pop < 30 && list[i].precipMm < 1;
    if (dry && start < 0) start = i;
    if (!dry && start >= 0) {
      if (!best || i - start > best.length) best = { from: list[start].date, to: list[i - 1].date, length: i - start };
      start = -1;
    }
  }
  return best;
}

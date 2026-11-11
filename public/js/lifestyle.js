// Member 1: everyday advice. What to wear, how good each activity is, and a short
// summary of the day. Pure functions, so all of it can be tested without a browser.
import { dateOf, hourOf } from './format.js';
import { isThunder } from './weather-codes.js';

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

export const ACTIVITIES = [
  { id: 'walking', icon: 'walk', temp: [14, 31], maxPop: 30, maxWind: 30, daylight: true },
  { id: 'running', icon: 'run', temp: [10, 27], maxPop: 25, maxWind: 28, daylight: true, exertion: true },
  { id: 'cycling', icon: 'cycle', temp: [12, 31], maxPop: 20, maxWind: 22, daylight: true, exertion: true },
  { id: 'cricket', icon: 'bat', temp: [16, 35], maxPop: 15, maxWind: 32, daylight: true, exertion: true },
  { id: 'picnic', icon: 'basket', temp: [17, 33], maxPop: 15, maxWind: 25, daylight: true },
  { id: 'laundry', icon: 'shirt', temp: [18, 45], maxPop: 10, maxWind: 40, daylight: true, dryAir: true },
  { id: 'kite', icon: 'kite', temp: [10, 40], maxPop: 15, minWind: 10, maxWind: 32, daylight: true },
  { id: 'stargazing', icon: 'star', temp: [5, 40], maxPop: 15, maxWind: 30, clearSky: true },
];

// Planner-only activities reuse the same scoring as the ones above.
export const PLAN_ACTIVITIES = [
  { id: 'event', icon: 'party', temp: [17, 34], maxPop: 12, maxWind: 25, daylight: true },
  { id: 'picnic', icon: 'basket', temp: [17, 33], maxPop: 15, maxWind: 25, daylight: true },
  { id: 'cricket', icon: 'bat', temp: [16, 35], maxPop: 15, maxWind: 32, daylight: true, exertion: true },
  { id: 'trek', icon: 'mountain', temp: [10, 30], maxPop: 15, maxWind: 28, daylight: true, exertion: true },
  { id: 'travel', icon: 'bag', temp: [8, 40], maxPop: 30, maxWind: 40, daylight: true },
  { id: 'harvest', icon: 'leaf', temp: [15, 40], maxPop: 10, maxWind: 30, daylight: true },
  { id: 'laundry', icon: 'shirt', temp: [18, 45], maxPop: 10, maxWind: 40, daylight: true, dryAir: true },
];

export function scoreHour(activity, hour, aqi = null) {
  if (activity.daylight && !hour.isDay) return 0;
  if (activity.clearSky && hour.isDay) return 0;

  let score = 100;
  const [low, high] = activity.temp;
  if (hour.feels < low) score -= (low - hour.feels) * 5;
  if (hour.feels > high) score -= (hour.feels - high) * 6;
  score -= hour.pop > activity.maxPop ? 20 + (hour.pop - activity.maxPop) : hour.pop * 0.2;
  if (hour.windKmh > activity.maxWind) score -= (hour.windKmh - activity.maxWind) * 2.5;
  if (activity.minWind && hour.windKmh < activity.minWind) score -= (activity.minWind - hour.windKmh) * 7;
  if (activity.daylight && hour.uv > 8) score -= (hour.uv - 8) * 6;
  if (activity.dryAir && hour.humidity != null && hour.humidity > 65) score -= (hour.humidity - 65) * 1.2;
  if (activity.clearSky && hour.cloud != null) score -= hour.cloud * 0.9;
  if (isThunder(hour.code)) score -= 50;
  if (aqi != null && aqi > 100) score -= (aqi - 100) * (activity.exertion ? 0.35 : 0.2);
  return Math.round(clamp(score, 0, 100));
}

export const levelOf = (score) => {
  if (score >= 80) return 'great';
  if (score >= 60) return 'good';
  if (score >= 35) return 'fair';
  return 'poor';
};

// Scores each activity by its best hour in the next `horizon` hours.
export function rateActivities(wx, horizon = 24) {
  const aqi = wx.air?.aqi ?? null;
  return ACTIVITIES.map((activity) => {
    let best = { score: 0, time: null };
    for (const hour of wx.hourly.slice(0, horizon)) {
      const score = scoreHour(activity, hour, aqi);
      if (score > best.score) best = { score, time: hour.time };
    }
    return { id: activity.id, icon: activity.icon, ...best, level: levelOf(best.score) };
  }).sort((a, b) => b.score - a.score);
}

const groupByDate = (hourly) => {
  const days = new Map();
  for (const hour of hourly) {
    const date = dateOf(hour.time);
    if (!days.has(date)) days.set(date, []);
    days.get(date).push(hour);
  }
  return days;
};

// Ranks the coming days for one activity: the average of its four best hours, with
// penalties for wet or stormy days, because rain at any time can spoil the plan.
export function rankDays(wx, activity) {
  const byDate = groupByDate(wx.hourly);
  const ranked = wx.daily.flatMap((day) => {
    const hours = byDate.get(day.date) ?? [];
    if (hours.length < 4) return [];
    const best = hours.map((h) => scoreHour(activity, h)).sort((a, b) => b - a).slice(0, 4);
    const average = best.reduce((total, s) => total + s, 0) / best.length;
    const wetPenalty = Math.min(day.precipMm, 20) * 1.5 + Math.max(day.pop - 40, 0) * 0.5;
    const stormPenalty = isThunder(day.code) ? 15 : 0;
    const score = Math.round(clamp(average - wetPenalty - stormPenalty, 0, 100));
    return [{ date: day.date, code: day.code, max: day.max, min: day.min, pop: day.pop, score, level: levelOf(score) }];
  });
  return { days: ranked, best: [...ranked].sort((a, b) => b.score - a.score)[0] ?? null };
}

export function wearAdvice(wx) {
  const next = wx.hourly.slice(0, 12);
  const feels = next.map((h) => h.feels);
  const high = Math.max(...feels);
  const low = Math.min(...feels);
  const maxPop = Math.max(...next.map((h) => h.pop));
  const maxWind = Math.max(...next.map((h) => h.windKmh));
  const maxUv = Math.max(...next.map((h) => h.uv));
  const items = [];

  if (high >= 30) items.push({ id: 'cotton', icon: 'shirt' });
  else if (high >= 22) items.push({ id: 'tshirt', icon: 'shirt' });
  if (low < 22 && low >= 12) items.push({ id: 'sweater', icon: 'jacket' });
  if (low < 12) items.push({ id: 'jacket', icon: 'jacket' });
  if (maxPop >= 70 && maxWind >= 20) items.push({ id: 'raincoat', icon: 'jacket' });
  else if (maxPop >= 40) items.push({ id: 'umbrella', icon: 'umbrella' });
  if (maxUv >= 6) items.push({ id: 'sunscreen', icon: 'sun' });
  if (maxUv >= 5) items.push({ id: 'sunglasses', icon: 'glasses' });
  if (maxUv >= 8) items.push({ id: 'hat', icon: 'hat' });
  if (high >= 35) items.push({ id: 'water', icon: 'drop' });
  if (wx.air && wx.air.aqi >= 150) items.push({ id: 'mask', icon: 'mask' });
  return items;
}

const PARTS = [
  { id: 'morning', from: 6, to: 12 },
  { id: 'afternoon', from: 12, to: 17 },
  { id: 'evening', from: 17, to: 21 },
  { id: 'night', from: 21, to: 30 },
];

// Splits the next 24 hours into named parts of the day, in the order they occur.
export function dayParts(wx) {
  const hours = wx.hourly.slice(0, 24);
  const partOf = (hour) => {
    const h = hourOf(hour.time);
    const shifted = h < 6 ? h + 24 : h;
    return PARTS.find((part) => shifted >= part.from && shifted < part.to).id;
  };
  const parts = [];
  for (const hour of hours) {
    const id = partOf(hour);
    let part = parts.at(-1);
    if (part?.id !== id) {
      part = { id, hours: [] };
      parts.push(part);
    }
    part.hours.push(hour);
  }
  return parts.slice(0, 4).map(({ id, hours: list }) => {
    const middle = list.at(Math.floor(list.length / 2));
    return {
      id,
      temp: list.reduce((total, h) => total + h.temp, 0) / list.length,
      pop: Math.max(...list.map((h) => h.pop)),
      code: middle.code,
      isDay: middle.isDay,
    };
  });
}

// Lower is better. Used to pick the most comfortable saved place right now. Polluted
// air counts heavily, because a pleasant temperature doesn't make up for it.
export function discomfort(wx) {
  const aqi = wx.air?.aqi ?? 50;
  return Math.abs(wx.current.feels - 24) + wx.hourly[0].pop / 10 + Math.max(aqi - 100, 0) / 8;
}

// One sentence for the top of the homepage.
export function headline(wx, thresholds) {
  const next = wx.hourly.slice(0, 12);
  const storm = next.find((h) => isThunder(h.code));
  if (storm) return { key: 'head.storm', params: { atAt: storm.time } };

  const now = wx.hourly[0];
  const wetNow = now.precipMm > 0.2 || now.pop >= 70;
  const dryHour = next.find((h) => h.pop < 30);
  if (wetNow && dryHour && dryHour !== now) return { key: 'head.rainStops', params: { atAt: dryHour.time } };
  if (wetNow) return { key: 'head.rainAllDay', params: {} };

  const rain = next.find((h) => h.pop >= thresholds.rain);
  if (rain) return { key: 'head.rainSoon', params: { atAt: rain.time } };

  const today = wx.daily[0];
  if (Math.max(...next.map((h) => h.feels)) >= thresholds.heat) return { key: 'head.hot', params: { peakTemp: today.max } };
  if (wx.air && wx.air.aqi >= thresholds.aqi) return { key: 'head.badAir', params: { aqi: wx.air.aqi } };
  if (wx.hourly.slice(0, 6).some((h) => h.visibility != null && h.visibility < 1000)) return { key: 'head.fog', params: {} };
  return { key: 'head.calm', params: { peakTemp: today.max } };
}

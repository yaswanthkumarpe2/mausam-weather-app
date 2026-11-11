// The personalization rules. Pure functions: forecast + profile in, a ranked list
// of messages out. Text lives in i18n.js; these only return keys and raw params.
import { dateOf, hourOf } from './format.js';
import { describeCode, isThunder } from './weather-codes.js';

const SEVERITY_SCORE = { warn: 90, watch: 60, good: 40, info: 30 };

const sum = (list, pick) => list.reduce((total, item) => total + (pick(item) ?? 0), 0);
const max = (list, pick) => list.reduce((top, item) => Math.max(top, pick(item) ?? -Infinity), -Infinity);

// First run of at least `minHours` consecutive hours that all satisfy `test`.
export function findWindow(hourly, test, minHours, horizon = 48) {
  const hours = hourly.slice(0, horizon);
  let start = -1;
  for (let i = 0; i <= hours.length; i++) {
    const ok = i < hours.length && test(hours[i]);
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) {
      if (i - start >= minHours) {
        return {
          from: hours[start].time,
          to: hourly[i]?.time ?? hours[i - 1].time,
          hours: i - start,
        };
      }
      start = -1;
    }
  }
  return null;
}

const COMMUTE_SLOTS = [
  { slot: 'morning', from: 8, to: 10 },
  { slot: 'evening', from: 17, to: 20 },
];

// The next (or current) commute slot in the forecast, with its worst conditions.
export function nextCommute(hourly) {
  for (let i = 0; i < hourly.length; i++) {
    const hour = hourOf(hourly[i].time);
    const match = COMMUTE_SLOTS.find((s) => hour >= s.from && hour < s.to);
    if (!match) continue;
    const day = dateOf(hourly[i].time);
    const hours = hourly
      .slice(i, i + (match.to - match.from))
      .filter((h) => dateOf(h.time) === day && hourOf(h.time) < match.to);
    return {
      slot: match.slot,
      day,
      maxPop: max(hours, (h) => h.pop),
      minVisibility: Math.min(...hours.map((h) => h.visibility ?? Infinity)),
      temp: hours[0].temp,
    };
  }
  return null;
}

export function firstRain(hourly, threshold, horizon = 24) {
  return hourly.slice(0, horizon).find((h) => h.pop >= threshold) ?? null;
}

export const sprayWindow = (hourly) =>
  findWindow(hourly, (h) => h.isDay && h.pop < 20 && h.windKmh < 15, 3);

function farmerRules(wx, add) {
  const nextDays = wx.daily.slice(0, 3);
  const rain = Math.round(sum(nextDays, (d) => d.precipMm));
  const waterLoss = Math.round(sum(nextDays, (d) => d.et0));

  if (rain >= 30) add('farmer', 'farmHeavyRain', 'warn', 'rain', { mm: rain });
  else if (rain >= 10) add('farmer', 'holdIrrigation', 'good', 'drop', { mm: rain });
  else if (waterLoss - rain >= 6) add('farmer', 'irrigate', 'watch', 'drop', { mm: rain, loss: waterLoss });

  const spray = sprayWindow(wx.hourly);
  if (spray) {
    add('farmer', 'sprayWindow', 'good', 'leaf', {
      day: dateOf(spray.from),
      fromAt: spray.from,
      toAt: spray.to,
    });
  } else {
    add('farmer', 'noSpray', 'info', 'leaf');
  }
}

function commuterRules(wx, add) {
  const commute = nextCommute(wx.hourly);
  if (!commute) return;
  const { slot, day, maxPop, minVisibility, temp } = commute;
  if (minVisibility < 1000) add('commuter', 'commuteFog', 'warn', 'fog', { slot, day });
  else if (maxPop >= 50) add('commuter', 'commuteWet', 'watch', 'rain', { slot, day, pop: maxPop });
  else add('commuter', 'commuteDry', 'good', 'bus', { slot, day, atTemp: temp });
}

function outdoorRules(wx, add, thresholds) {
  const best = findWindow(
    wx.hourly,
    (h) => h.isDay && h.feels >= 12 && h.feels <= 33 && h.pop < 30 && h.uv < 7,
    2,
    24,
  );
  if (best) {
    add('outdoor', 'outdoorWindow', 'good', 'run', {
      day: dateOf(best.from),
      fromAt: best.from,
      toAt: best.to,
    });
  } else {
    add('outdoor', 'noOutdoor', 'watch', 'run');
  }
  if (wx.daily[0].uvMax >= 8) add('outdoor', 'uvHigh', 'watch', 'sun', { uv: Math.round(wx.daily[0].uvMax) });
  if (wx.air && wx.air.aqi >= thresholds.aqi) {
    add('outdoor', 'aqiHigh', 'warn', 'lungs', { aqi: wx.air.aqi });
  }
}

function healthRules(wx, add, thresholds) {
  if (wx.air) {
    const { aqi } = wx.air;
    if (aqi >= thresholds.aqi) add('health', 'aqiHigh', 'warn', 'lungs', { aqi });
    else if (aqi > 100) add('health', 'aqiModerate', 'watch', 'lungs', { aqi });
    else add('health', 'aqiFine', 'good', 'lungs', { aqi });
  }
  const peakFeels = max(wx.hourly.slice(0, 24), (h) => h.feels);
  if (peakFeels >= thresholds.heat) add('health', 'heatStress', 'warn', 'heat', { peakTemp: peakFeels });
  if (wx.daily[0].min <= 10) add('health', 'coldMorning', 'watch', 'heat', { lowTemp: wx.daily[0].min });
  if (wx.daily[0].uvMax >= 8) add('health', 'uvHigh', 'watch', 'sun', { uv: Math.round(wx.daily[0].uvMax) });
}

function travellerRules(wx, add) {
  const tomorrow = wx.daily[1];
  if (tomorrow) {
    add('traveller', 'tomorrow', 'info', 'bag', {
      cond: describeCode(tomorrow.code).key,
      highTemp: tomorrow.max,
      lowTemp: tomorrow.min,
      pop: tomorrow.pop,
    });
  }
  const ahead = wx.daily.slice(1, 7);
  if (ahead.length) {
    const driest = ahead.reduce((a, b) => (b.pop < a.pop ? b : a));
    add('traveller', 'driestDay', 'good', 'bag', { day: driest.date, pop: driest.pop });
  }
}

export function buildInsights(wx, personas, thresholds) {
  const items = new Map();
  const add = (persona, id, severity, icon, params = {}) => {
    if (items.has(id)) return; // Two interests can raise the same point; say it once.
    items.set(id, {
      id,
      persona,
      severity,
      icon,
      params,
      titleKey: `ins.${id}.title`,
      bodyKey: `ins.${id}.body`,
      score: SEVERITY_SCORE[severity],
    });
  };

  if (personas.includes('farmer')) farmerRules(wx, add);
  if (personas.includes('commuter')) commuterRules(wx, add);
  if (personas.includes('outdoor')) outdoorRules(wx, add, thresholds);
  if (personas.includes('health')) healthRules(wx, add, thresholds);
  if (personas.includes('traveller')) travellerRules(wx, add);

  if (items.size === 0) {
    const rain = firstRain(wx.hourly, thresholds.rain, 12);
    if (rain) add(null, 'rainSoon', 'watch', 'rain', { rainAt: rain.time, pop: rain.pop });
    add(null, 'today', 'info', 'sun', {
      highTemp: wx.daily[0].max,
      lowTemp: wx.daily[0].min,
      pop: wx.daily[0].pop,
    });
  }

  return [...items.values()].sort((a, b) => b.score - a.score);
}

// Alerts compare the forecast with the user's own thresholds. They are not
// official warnings, and the UI says so wherever they appear.
export function buildAlerts(wx, thresholds) {
  const alerts = [];
  const next12 = wx.hourly.slice(0, 12);
  const next24 = wx.hourly.slice(0, 24);

  const storm = next12.find((h) => isThunder(h.code));
  if (storm) alerts.push({ id: 'storm', severity: 'warn', icon: 'storm', params: { stormAt: storm.time } });

  const rain = firstRain(wx.hourly, thresholds.rain, 12);
  if (rain && !storm) {
    const mm = Math.round(sum(next12, (h) => h.precipMm));
    alerts.push({
      id: 'rain',
      severity: mm >= 15 ? 'warn' : 'watch',
      icon: 'rain',
      params: { rainAt: rain.time, pop: rain.pop, mm },
    });
  }

  const peakFeels = max(next24, (h) => h.feels);
  if (peakFeels >= thresholds.heat) {
    alerts.push({ id: 'heat', severity: 'warn', icon: 'heat', params: { peakTemp: peakFeels } });
  }

  const peakGust = max(next24, (h) => h.gustKmh);
  if (peakGust >= thresholds.wind) {
    alerts.push({ id: 'wind', severity: 'watch', icon: 'wind', params: { gustWind: peakGust } });
  }

  if (wx.air && wx.air.aqi >= thresholds.aqi) {
    alerts.push({ id: 'aqi', severity: 'warn', icon: 'lungs', params: { aqi: wx.air.aqi } });
  }

  return alerts;
}

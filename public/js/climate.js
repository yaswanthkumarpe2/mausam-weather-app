// Member 2: looks back at past weather. Works on the archive format returned by
// fetchArchive(): { time: [...], max: [...], min: [...], rain: [...] }.
import { addDays } from './format.js';

const round1 = (value) => Math.round(value * 10) / 10;

function range(archive, from, to) {
  const rows = [];
  archive.time.forEach((date, i) => {
    if (date < from || date > to || archive.max[i] == null) return;
    rows.push({ date, max: archive.max[i], min: archive.min[i], rain: archive.rain[i] ?? 0 });
  });
  return rows;
}

const shiftYear = (date, years) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;
const mean = (rows, pick) => (rows.length ? rows.reduce((total, row) => total + pick(row), 0) / rows.length : 0);
const total = (rows, pick) => rows.reduce((sum, row) => sum + pick(row), 0);

export function lastDate(archive) {
  for (let i = archive.time.length - 1; i >= 0; i--) {
    if (archive.max[i] != null) return archive.time[i];
  }
  return null;
}

export function compareLastYear(archive, days = 30) {
  const end = lastDate(archive);
  if (!end) return null;
  const start = addDays(end, -(days - 1));
  const now = range(archive, start, end);
  const before = range(archive, shiftYear(start, -1), shiftYear(end, -1));
  if (!now.length || !before.length) return null;

  const stats = (rows) => ({
    avgMax: round1(mean(rows, (r) => r.max)),
    avgMin: round1(mean(rows, (r) => r.min)),
    rain: Math.round(total(rows, (r) => r.rain)),
    wetDays: rows.filter((r) => r.rain >= 1).length,
  });
  const thisYear = stats(now);
  const lastYear = stats(before);
  return {
    from: start,
    to: end,
    thisYear,
    lastYear,
    warmer: round1(thisYear.avgMax - lastYear.avgMax),
    rows: now,
    previous: before,
  };
}

function seasonTotals(archive, year, cutoffMonthDay) {
  const end = `${year}-${cutoffMonthDay < '09-30' ? cutoffMonthDay : '09-30'}`;
  const rows = range(archive, `${year}-06-01`, end);
  let running = 0;
  return rows.map((row) => {
    running += row.rain;
    return { date: row.date, total: Math.round(running) };
  });
}

// Monsoon season rainfall, June to September, against the year before at the same
// point. Before June, it shows the most recent complete season instead.
export function monsoonCompare(archive) {
  const end = lastDate(archive);
  if (!end) return null;
  const inSeason = end.slice(5) >= '06-01';
  const year = Number(end.slice(0, 4)) - (inSeason ? 0 : 1);
  const cutoff = inSeason ? end.slice(5) : '09-30';
  const current = seasonTotals(archive, year, cutoff);
  const previous = seasonTotals(archive, year - 1, cutoff);
  if (!current.length || !previous.length) return null;

  const now = current.at(-1).total;
  const before = previous.at(-1).total;
  return {
    year,
    current,
    previous,
    total: now,
    lastTotal: before,
    change: before ? Math.round(((now - before) / before) * 100) : 0,
    finished: end.slice(5) >= '09-30' || !inSeason,
  };
}

// The same calendar day in each past year. The newest usable date stands in for
// today, because the archive runs a few days behind.
export function sameDayHistory(archive, years = 5) {
  const end = lastDate(archive);
  if (!end) return [];
  const rows = [];
  for (let back = 0; back < years; back++) {
    const date = shiftYear(end, -back);
    const index = archive.time.indexOf(date);
    if (index >= 0 && archive.max[index] != null) {
      rows.push({ date, max: archive.max[index], min: archive.min[index], rain: round1(archive.rain[index] ?? 0) });
    }
  }
  return rows;
}

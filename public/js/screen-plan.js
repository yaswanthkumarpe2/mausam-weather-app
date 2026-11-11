// Member 4 (best day, trip) and Member 2 (compare, climate): Plan screen markup.
import { LEVEL_COLOR } from './cards.js';
import { lineChart, ring } from './charts.js';
import { compareLastYear, monsoonCompare, sameDayHistory } from './climate.js';
import { addDays, esc, fmtHour, fmtLongDate, fmtMonth, fmtRelativeDay, fmtTemp, fmtWeekday, fmtWind, toUnitTemp } from './format.js';
import { icon } from './icons.js';
import { PLAN_ACTIVITIES, discomfort, rankDays } from './lifestyle.js';
import { screenHead } from './screen-parts.js';
import { describeCode } from './weather-codes.js';

const SEGMENTS = ['best', 'trip', 'compare', 'climate'];

function bestDaySegment(ctx) {
  const { t, wx, lang, units, today, ui } = ctx;
  const activity = PLAN_ACTIVITIES.find((a) => a.id === ui.planActivity) ?? PLAN_ACTIVITIES[0];
  const { days, best } = rankDays(wx, activity);
  const chips = PLAN_ACTIVITIES.map(({ id, icon: name }) => `
    <button class="chip" data-action="set-activity" data-id="${id}" aria-pressed="${id === activity.id}">${icon(name, 'icon-sm')}${esc(t(`act.${id}`))}</button>`);

  const hero = best ? `
    <section class="card best-card">
      ${ring({ value: best.score, size: 88, stroke: 9, color: LEVEL_COLOR[best.level], label: String(best.score) })}
      <div>
        <p class="lead">${esc(t('best.top', { day: fmtRelativeDay(best.date, today, t, lang) }))}</p>
        <p class="sub">${esc(fmtLongDate(best.date, lang))}</p>
        <p class="sub">${esc(t(`wx.${describeCode(best.code).key}`))}, ${fmtTemp(best.min, units.temp)}–${fmtTemp(best.max, units.temp)}, ${best.pop}%</p>
      </div>
    </section>` : '';

  const tiles = days.map((day) => `
    <li class="score-day" data-level="${day.level}" ${day.date === best?.date ? 'data-best="true"' : ''}>
      <small>${esc(day.date === today ? t('day.today') : fmtWeekday(day.date, lang))}</small>
      <span class="sub">${esc(day.date.slice(8))}</span>
      ${icon(describeCode(day.code).icon)}
      <strong>${day.score}</strong>
    </li>`);

  return `
    <div class="screen-controls">
      <p class="field-label">${esc(t('best.pick'))}</p>
      <div class="chips chips-flow">${chips.join('')}</div>
    </div>
    <div class="cards">
      ${hero}
      <section class="card">
        <h2>${esc(t('best.calendar'))}</h2>
        <ul class="score-grid">${tiles.join('')}</ul>
      </section>
    </div>`;
}

function tripResult(ctx) {
  const { t, lang, units, today, trip } = ctx;
  if (trip.loading) return `<p class="screen-loading" role="status">${esc(t('trip.checking'))}</p>`;
  if (trip.failed) return `<p class="notice">${esc(t('trip.failed'))}</p>`;
  if (!trip.result) return '';
  const { assessment, best, km, hours, names } = trip.result;

  const stopName = (stop, last) => {
    if (stop.index === 0) return `${t('trip.stopStart')}: ${names.from}`;
    if (stop.index === last) return `${t('trip.stopEnd')}: ${names.to}`;
    return t('trip.stopMid', { pct: Math.round((stop.index / last) * 100) });
  };
  const last = assessment.stops.length - 1;
  const stops = assessment.stops.map((stop) => {
    const h = stop.hour;
    return `
      <li class="stop" data-risk="${stop.risk >= 3 ? 'high' : stop.risk >= 1 ? 'some' : 'none'}">
        <span class="stop-dot"></span>
        <div class="stop-main">
          <strong>${esc(stopName(stop, last))}</strong>
          <small>${esc(fmtRelativeDay(stop.eta.slice(0, 10), today, t, lang))}, ${esc(fmtHour(stop.eta, lang))}</small>
        </div>
        ${h ? `${icon(describeCode(h.code, h.isDay).icon)}
          <span class="stop-values"><strong>${fmtTemp(h.temp, units.temp)}</strong><small>${h.pop}% · ${esc(fmtWind(h.windKmh, units.wind))}</small></span>`
        : `<small class="sub">${esc(t('trip.noData'))}</small>`}
      </li>`;
  });

  return `
    <section class="card verdict" data-verdict="${assessment.verdict}">
      <p class="lead">${esc(t(`trip.${assessment.verdict}`))}</p>
      <p>${esc(t(`trip.${assessment.verdict}Body`))}</p>
      <p class="sub">${esc(t('trip.estimate', { km, hours: Math.round(hours * 10) / 10 }))}</p>
      ${best ? `<p class="best-leave">${icon('calendar', 'icon-sm')}${esc(t('trip.bestLeave', { day: fmtRelativeDay(best.departure.slice(0, 10), today, t, lang), atAt: fmtHour(best.departure, lang) }))}</p>` : ''}
    </section>
    <section class="card"><ol class="stops">${stops.join('')}</ol></section>`;
}

function tripSegment(ctx, location) {
  const { t, lang, today, trip } = ctx;
  const dayOptions = Array.from({ length: 5 }, (_, i) => {
    const date = addDays(today, i);
    return `<option value="${date}" ${date === trip.date ? 'selected' : ''}>${esc(fmtRelativeDay(date, today, t, lang))}</option>`;
  });
  const hourOptions = Array.from({ length: 24 }, (_, hour) => {
    const iso = `${today}T${String(hour).padStart(2, '0')}:00`;
    return `<option value="${hour}" ${hour === trip.hour ? 'selected' : ''}>${esc(fmtHour(iso, lang))}</option>`;
  });

  return `
    <div class="cards">
      <section class="card">
        <p class="field-label">${esc(t('trip.from'))}</p>
        <p class="trip-from">${icon('pin', 'icon-sm')}${esc(location.name)}</p>
        <p class="field-label">${esc(t('trip.to'))}</p>
        ${trip.to
          ? `<button class="trip-to" data-action="trip-clear">${icon('pin', 'icon-sm')}<span>${esc(trip.to.name)}</span>${icon('close', 'icon-sm')}</button>`
          : `<label class="search">${icon('search')}
              <input id="trip-search" type="search" autocomplete="off" placeholder="${esc(t('trip.search'))}" aria-label="${esc(t('trip.search'))}">
            </label>
            <div id="trip-results" aria-live="polite"></div>`}
        <div class="trip-when">
          <label><span class="field-label">${esc(t('trip.day'))}</span><select id="trip-date">${dayOptions.join('')}</select></label>
          <label><span class="field-label">${esc(t('trip.hour'))}</span><select id="trip-hour">${hourOptions.join('')}</select></label>
        </div>
        <button class="primary-button wide" data-action="trip-check">${esc(t('trip.check'))}</button>
        ${trip.needsTo ? `<p class="sub" role="status">${esc(t('trip.pickTo'))}</p>` : ''}
      </section>
      ${tripResult(ctx)}
    </div>
    <p class="screen-note">${esc(t('trip.note'))}</p>`;
}

function compareSegment(ctx) {
  const { t, prefs, compare, units } = ctx;
  if (prefs.locations.length < 2) {
    return `
      <div class="cards"><section class="card">
        <p class="lead">${esc(t('compare.needMore'))}</p>
        <button class="primary-button wide" data-action="open-sheet" data-sheet="locations">${esc(t('compare.add'))}</button>
      </section></div>`;
  }
  if (compare.loading) return `<p class="screen-loading" role="status">${esc(t('compare.loading'))}</p>`;

  const places = prefs.locations.slice(0, 4).filter((place) => compare.data[place.id]);
  const best = places.length
    ? places.reduce((a, b) => (discomfort(compare.data[b.id]) < discomfort(compare.data[a.id]) ? b : a))
    : null;

  const row = (labelKey, value) => `
    <tr><th scope="row">${esc(t(labelKey))}</th>${places.map((place) => `<td>${value(compare.data[place.id])}</td>`).join('')}</tr>`;

  return `
    <div class="cards">
      ${best ? `<section class="card"><p class="lead">${esc(t('compare.best', { name: best.name }))}</p></section>` : ''}
      <section class="card">
        <h2>${esc(t('compare.title'))}</h2>
        <div class="table-scroll" tabindex="0">
          <table class="compare">
            <thead><tr><td></td>${places.map((place) => `<th scope="col">${esc(place.name)}</th>`).join('')}</tr></thead>
            <tbody>
              <tr><th scope="row">${esc(t('compare.now'))}</th>${places.map((place) => {
                const wx = compare.data[place.id];
                return `<td>${icon(describeCode(wx.current.code, wx.current.isDay).icon)}<strong>${fmtTemp(wx.current.temp, units.temp)}</strong></td>`;
              }).join('')}</tr>
              ${row('compare.feels', (wx) => fmtTemp(wx.current.feels, units.temp))}
              ${row('compare.range', (wx) => `${fmtTemp(wx.daily[0].min, units.temp)}–${fmtTemp(wx.daily[0].max, units.temp)}`)}
              ${row('compare.rain', (wx) => `${wx.daily[0].pop}%`)}
              ${row('compare.wind', (wx) => esc(fmtWind(wx.current.windKmh, units.wind)))}
              ${row('compare.aqi', (wx) => wx.air?.aqi ?? '–')}
              ${row('compare.uv', (wx) => Math.round(wx.daily[0].uvMax))}
            </tbody>
          </table>
        </div>
      </section>
    </div>`;
}

function climateSegment(ctx) {
  const { t, climate, lang, units } = ctx;
  if (climate.loading) return `<p class="screen-loading" role="status">${esc(t('climate.loading'))}</p>`;
  if (climate.failed || !climate.archive) {
    return `<div class="notice"><p>${esc(t('climate.failed'))}</p><button class="text-button" data-action="load-climate">${esc(t('action.retry'))}</button></div>`;
  }

  const year = compareLastYear(climate.archive);
  const monsoon = monsoonCompare(climate.archive);
  const history = sameDayHistory(climate.archive);
  const yearLabels = year ? year.rows.flatMap((row, index) => (index % 10 === 0 ? [{ index, text: esc(row.date.slice(8)) + '/' + esc(row.date.slice(5, 7)) }] : [])) : [];

  let difference = 'climate.same';
  if (year?.warmer >= 0.5) difference = 'climate.warmer';
  else if (year?.warmer <= -0.5) difference = 'climate.cooler';

  const monsoonKey = monsoon
    ? `climate.monsoon${monsoon.finished ? 'Done' : ''}${monsoon.change >= 0 ? 'Up' : 'Down'}`
    : null;

  return `
    <div class="cards">
      ${year ? `
      <section class="card">
        <h2>${esc(t('climate.vsLastYear'))}</h2>
        <p class="lead">${esc(t(difference, { deg: Math.abs(year.warmer) }))}</p>
        ${lineChart({
          id: 'year',
          series: [
            { values: year.rows.map((r) => toUnitTemp(r.max, units.temp)), color: 'var(--c-sun)', fill: true },
            { values: year.previous.map((r) => toUnitTemp(r.max, units.temp)), color: 'var(--muted)', dashed: true },
          ],
          labels: yearLabels,
          ariaLabel: esc(t('climate.chart')),
          format: (v) => `${Math.round(v)}°`,
        })}
        <div class="legend">
          <span><i style="background:var(--c-sun)"></i>${esc(t('climate.thisYear'))}</span>
          <span><i style="background:var(--muted)"></i>${esc(t('climate.lastYear'))}</span>
        </div>
        <dl class="tiles">
          <div><dt>${esc(t('climate.rainTotal'))}</dt><dd>${year.thisYear.rain} / ${year.lastYear.rain} mm</dd></div>
          <div><dt>${esc(t('climate.wetDays'))}</dt><dd>${year.thisYear.wetDays} / ${year.lastYear.wetDays}</dd></div>
        </dl>
      </section>` : ''}
      ${monsoon ? `
      <section class="card">
        <h2>${esc(t('climate.monsoon', { year: monsoon.year }))}</h2>
        <p class="lead">${esc(t(monsoonKey, { mm: monsoon.total, pct: Math.abs(monsoon.change) }))}</p>
        ${lineChart({
          id: 'monsoon',
          series: [
            { values: monsoon.current.map((r) => r.total), color: 'var(--c-rain)', fill: true },
            { values: monsoon.previous.map((r) => r.total), color: 'var(--muted)', dashed: true },
          ],
          labels: [0, 30, 61, 92]
            .filter((index) => index < monsoon.current.length)
            .map((index) => ({ index, text: esc(fmtMonth(monsoon.current[index].date, lang)) })),
          min: 0,
          ariaLabel: esc(t('climate.monsoonChart')),
        })}
        <div class="legend">
          <span><i style="background:var(--c-rain)"></i>${monsoon.year}</span>
          <span><i style="background:var(--muted)"></i>${monsoon.year - 1}</span>
        </div>
      </section>` : ''}
      ${history.length ? `
      <section class="card">
        <h2>${esc(t('climate.sameDay'))}</h2>
        <ul class="history">${history.map((row) => `
          <li>
            <span>${esc(row.date.slice(0, 4))}</span>
            <span class="sub">${esc(fmtLongDate(row.date, lang))}</span>
            <strong>${fmtTemp(row.min, units.temp)}–${fmtTemp(row.max, units.temp)}</strong>
            <span class="day-pop">${row.rain} mm</span>
          </li>`).join('')}</ul>
      </section>` : ''}
    </div>
    <p class="screen-note">${esc(t('climate.note'))}</p>`;
}

export function renderPlan(ctx, location) {
  const { t, wx, ui } = ctx;
  const head = screenHead(ctx, location, 'plan.title');
  if (!wx) return `${head}<p class="screen-loading">${esc(t('status.loading'))}</p>`;

  const segment = ui.planSegment;
  const tabs = SEGMENTS.map((id) => `
    <button data-action="set-segment" data-id="${id}" aria-pressed="${id === segment}">${esc(t(`seg.${id}`))}</button>`);
  const body = {
    best: () => bestDaySegment(ctx),
    trip: () => tripSegment(ctx, location),
    compare: () => compareSegment(ctx),
    climate: () => climateSegment(ctx),
  }[segment]();

  return `${head}<div class="screen-controls"><div class="segmented">${tabs.join('')}</div></div>${body}`;
}

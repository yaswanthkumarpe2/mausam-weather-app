// Member 3: Health screen markup.
import { AQI_COLOR } from './cards.js';
import { lineChart, ring } from './charts.js';
import { aqiBand, esc, fmtHour, fmtTemp, formatParams } from './format.js';
import {
  CONDITIONS, bestOutdoorHour, conditionAdvice, heatBand, heatIndex, mainPollutant, pollutantLevels,
  safeHours, uvWindow,
} from './health.js';
import { icon } from './icons.js';
import { screenHead } from './screen-parts.js';

const everySix = (hours, lang) => hours.flatMap((h, index) => (index % 6 === 0 ? [{ index, text: esc(fmtHour(h.time, lang)) }] : []));

function airCard(ctx) {
  const { t, wx } = ctx;
  if (!wx.air) return `<section class="card"><h2>${esc(t('card.air'))}</h2><p class="sub">${esc(t('air.unavailable'))}</p></section>`;
  const band = aqiBand(wx.air.aqi);
  const main = mainPollutant(wx.air);
  return `
    <section class="card">
      <h2>${esc(t('card.air'))}</h2>
      <div class="metric-row">
        ${ring({ value: wx.air.aqi, max: 300, size: 92, stroke: 9, color: AQI_COLOR[band], label: String(wx.air.aqi) })}
        <div>
          <p class="lead">${esc(t(`aqi.${band}`))}</p>
          <p class="sub">${esc(t('air.scale'))}</p>
          ${main ? `<p class="sub">${esc(t('health.main', { name: main.label }))}</p>` : ''}
        </div>
      </div>
    </section>`;
}

function safeCard(ctx) {
  const { t, wx, lang, prefs } = ctx;
  const slots = safeHours(wx, prefs.health.conditions);
  const best = bestOutdoorHour(slots);
  const strip = slots.map((slot, i) => `
    <span class="safe" data-status="${slot.status}" title="${esc(fmtHour(slot.time, lang))}: ${esc(t(`safe.${slot.status}`))}">${i % 6 === 0 ? `<small>${esc(fmtHour(slot.time, lang))}</small>` : ''}</span>`);
  return `
    <section class="card">
      <h2>${esc(t('health.safe'))}</h2>
      <p class="lead">${esc(best ? t('health.safeBest', formatParams({ fromAt: best.from, toAt: best.to }, ctx)) : t('health.safeNone'))}</p>
      <div class="safe-strip" role="img" aria-label="${esc(t('health.safe'))}">${strip.join('')}</div>
      <div class="legend">
        <span><i data-status="good"></i>${esc(t('safe.good'))}</span>
        <span><i data-status="caution"></i>${esc(t('safe.caution'))}</span>
        <span><i data-status="avoid"></i>${esc(t('safe.avoid'))}</span>
      </div>
    </section>`;
}

function aqiForecastCard(ctx) {
  const { t, wx, lang } = ctx;
  const hours = wx.air?.hourly?.slice(0, 48) ?? [];
  if (hours.length < 6) return '';
  return `
    <section class="card">
      <h2>${esc(t('health.aqiChart'))}</h2>
      ${lineChart({
        id: 'aqi',
        series: [{ values: hours.map((h) => h.aqi), color: 'var(--accent)', fill: true }],
        labels: hours.flatMap((h, index) => (index % 12 === 0 ? [{ index, text: esc(fmtHour(h.time, lang)) }] : [])),
        min: 0,
        ariaLabel: esc(t('health.aqiChart')),
      })}
    </section>`;
}

function pollutantsCard(ctx) {
  const { t, wx } = ctx;
  if (!wx.air) return '';
  const rows = pollutantLevels(wx.air).map((p) => `
    <li>
      <div><strong>${esc(p.label)}</strong><span class="sub">${p.value} µg/m³</span></div>
      <span class="meter"><span data-level="${p.level}" style="width:${Math.min(p.ratio / 3, 1) * 100}%"></span></span>
      <small class="sub">${esc(t('health.ofGuide', { pct: Math.round(p.ratio * 100) }))}</small>
    </li>`);
  return rows.length ? `<section class="card"><h2>${esc(t('health.pollutants'))}</h2><ul class="pollutants">${rows.join('')}</ul></section>` : '';
}

function sunHeatCard(ctx) {
  const { t, wx, lang, units } = ctx;
  const hours = wx.hourly.slice(0, 24);
  const window = uvWindow(wx.hourly);
  const index = heatIndex(wx.current.temp, wx.current.humidity);
  return `
    <section class="card">
      <h2>${esc(t('health.uvHeat'))}</h2>
      <p class="lead">${esc(window ? t('health.uvNeed', formatParams({ fromAt: window.from, toAt: window.to }, ctx)) : t('health.uvNone'))}</p>
      ${lineChart({
        id: 'uv',
        series: [{ values: hours.map((h) => h.uv), color: 'var(--c-sun)', fill: true }],
        labels: everySix(hours, lang),
        min: 0,
        max: Math.max(11, ...hours.map((h) => h.uv)),
        height: 120,
        ariaLabel: esc(t('health.uvChart')),
      })}
      <dl class="tiles">
        <div><dt>${esc(t('health.heatIndex'))}</dt><dd>${fmtTemp(index, units.temp)}</dd></div>
        <div><dt>&nbsp;</dt><dd>${esc(t(`heat.${heatBand(index)}`))}</dd></div>
      </dl>
    </section>`;
}

function adviceCard(ctx) {
  const { t, wx, prefs } = ctx;
  const tips = conditionAdvice(wx, prefs.health.conditions);
  return `
    <section class="card">
      <h2>${esc(t('health.advice'))}</h2>
      <ul class="insights">${tips.map((tip) => `
        <li class="insight" data-severity="${tip.severity}">
          <span class="insight-icon">${icon('heart')}</span>
          <div><p>${esc(t(`tip.${tip.id}`, formatParams(tip.params, ctx)))}</p></div>
        </li>`).join('')}</ul>
    </section>`;
}

export function renderHealth(ctx, location) {
  const { t, wx, prefs } = ctx;
  const head = screenHead(ctx, location, 'health.title');
  if (!wx) return `${head}<p class="screen-loading">${esc(t('status.loading'))}</p>`;

  const chips = CONDITIONS.map(({ id, icon: name }) => `
    <button class="chip" data-action="toggle-condition" data-id="${id}"
      aria-pressed="${prefs.health.conditions.includes(id)}">${icon(name, 'icon-sm')}${esc(t(`cond.${id}`))}</button>`);

  return `
    ${head}
    <div class="screen-controls">
      <p class="field-label">${esc(t('health.who'))}</p>
      <div class="chips chips-flow">${chips.join('')}</div>
    </div>
    <div class="cards">
      ${airCard(ctx)}
      ${adviceCard(ctx)}
      ${safeCard(ctx)}
      ${aqiForecastCard(ctx)}
      ${pollutantsCard(ctx)}
      ${sunHeatCard(ctx)}
    </div>
    <p class="screen-note">${esc(t('health.note'))}</p>`;
}

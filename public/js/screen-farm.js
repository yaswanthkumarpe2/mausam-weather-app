// Member 3: Farm screen markup.
import { pairedBars } from './charts.js';
import { CROPS, STAGES, cropById, cropRisks, dryWindow, growingDegreeDays, sprayCalendar, waterBalance } from './farm.js';
import { esc, fmtRelativeDay, fmtTemp, fmtWeekday, formatParams } from './format.js';
import { icon } from './icons.js';
import { screenHead } from './screen-parts.js';

function waterCard(ctx, balance) {
  const { t, lang } = ctx;
  const message = balance.status === 'deficit'
    ? t('water.deficit', { mm: balance.irrigate })
    : t(`water.${balance.status}`);
  return `
    <section class="card">
      <h2>${esc(t('water.title'))}</h2>
      <p class="lead">${esc(message)}</p>
      <dl class="tiles tiles-3">
        <div><dt>${esc(t('water.need'))}</dt><dd>${Math.round(balance.need)} mm</dd></div>
        <div><dt>${esc(t('water.rain'))}</dt><dd>${Math.round(balance.rain)} mm</dd></div>
        <div><dt>${esc(t('water.irrigate'))}</dt><dd>${balance.irrigate} mm</dd></div>
      </dl>
      ${pairedBars({
        groups: balance.rows.map((row) => ({ label: esc(fmtWeekday(row.date, lang)), a: row.rain, b: row.need })),
        colorA: 'var(--c-rain)',
        colorB: 'var(--c-sun)',
        ariaLabel: esc(t('water.chart')),
      })}
      <div class="legend">
        <span><i style="background:var(--c-rain)"></i>${esc(t('water.rain'))}</span>
        <span><i style="background:var(--c-sun)"></i>${esc(t('water.need'))}</span>
      </div>
    </section>`;
}

function sprayCard(ctx) {
  const { t, wx, lang, today } = ctx;
  const days = sprayCalendar(wx.hourly);
  const header = ['morning', 'midday', 'evening'].map((id) => `<span>${esc(t(`spray.${id}`))}</span>`);
  const rows = days.map((day) => `
    <div class="spray-row">
      <strong>${esc(fmtRelativeDay(day.date, today, t, lang))}</strong>
      ${day.slots.map((slot) => `<span class="spray" data-rating="${slot.rating}">${esc(t(`spray.${slot.rating}`))}</span>`).join('')}
    </div>`);
  return `
    <section class="card">
      <h2>${esc(t('spray.title'))}</h2>
      <div class="spray-grid">
        <div class="spray-row spray-head"><span></span>${header.join('')}</div>
        ${rows.join('')}
      </div>
    </section>`;
}

function risksCard(ctx, crop) {
  const { t, wx } = ctx;
  const risks = cropRisks(wx, crop);
  const body = risks.length
    ? `<ul>${risks.map((risk) => `
        <li class="alert" data-severity="${risk.severity}">${icon(risk.icon)}<span>${esc(t(`risk.${risk.id}`, formatParams(risk.params, ctx)))}</span></li>`).join('')}</ul>`
    : `<p class="all-clear">${icon('check')}<span>${esc(t('risk.none'))}</span></p>`;
  return `<section class="card"><h2>${esc(t('risk.title'))}</h2>${body}</section>`;
}

function soilCard(ctx) {
  const { t, wx, units, lang, today } = ctx;
  const { soil, soilTemp } = wx.hourly[0];
  const dry = dryWindow(wx.daily);
  const dryText = dry
    ? t('soil.dryValue', { days: dry.length, day: fmtRelativeDay(dry.from, today, t, lang) })
    : t('soil.dryNone');
  return `
    <section class="card">
      <h2>${esc(t('soil.title'))}</h2>
      <dl class="tiles">
        <div><dt>${esc(t('soil.moisture'))}</dt><dd>${soil == null ? '–' : `${Math.round(soil * 100)}%`}</dd></div>
        <div><dt>${esc(t('soil.temp'))}</dt><dd>${soilTemp == null ? '–' : fmtTemp(soilTemp, units.temp)}</dd></div>
        <div><dt>${esc(t('soil.gdd'))}</dt><dd>${growingDegreeDays(wx.daily)}</dd></div>
        <div><dt>${esc(t('soil.dry'))}</dt><dd>${esc(dryText)}</dd></div>
      </dl>
    </section>`;
}

export function renderFarm(ctx, location) {
  const { t, wx, prefs } = ctx;
  const crop = cropById(prefs.farm.crop);
  const head = screenHead(ctx, location, 'farm.title');
  if (!wx) return `${head}<p class="screen-loading">${esc(t('status.loading'))}</p>`;

  const crops = CROPS.map(({ id }) => `
    <button class="chip" data-action="set-crop" data-id="${id}" aria-pressed="${id === crop.id}">${esc(t(`crop.${id}`))}</button>`);
  const stages = STAGES.map((id) => `
    <button data-action="set-stage" data-id="${id}" aria-pressed="${id === prefs.farm.stage}">${esc(t(`stage.${id}`))}</button>`);

  return `
    ${head}
    <div class="screen-controls">
      <p class="field-label">${esc(t('farm.crop'))}</p>
      <div class="chips chips-flow">${crops.join('')}</div>
      <p class="field-label">${esc(t('farm.stage'))}</p>
      <div class="segmented">${stages.join('')}</div>
    </div>
    <div class="cards">
      ${waterCard(ctx, waterBalance(wx.daily, crop, prefs.farm.stage))}
      ${risksCard(ctx, crop)}
      ${sprayCard(ctx)}
      ${soilCard(ctx)}
    </div>
    <p class="screen-note">${esc(t('farm.note'))}</p>`;
}

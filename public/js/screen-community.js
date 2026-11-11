// Member 4: Community screen, report form and alert centre markup.
import { alertRows, reportRow } from './cards.js';
import { esc, fmtWeekday, formatParams } from './format.js';
import { icon } from './icons.js';
import { buildAlerts } from './insights.js';
import { screenHead } from './screen-parts.js';

const REPORT_ICONS = {
  clear: 'sun', rain: 'rain', heavyRain: 'rain', waterlogging: 'drop', storm: 'storm', fog: 'fog', heat: 'heat', dust: 'wind',
};

export function renderCommunity(ctx, location) {
  const { t, reports } = ctx;
  const list = reports.list;
  const counts = {};
  for (const report of list) counts[report.type] = (counts[report.type] ?? 0) + 1;
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type, count]) => `
    <li>${icon(REPORT_ICONS[type] ?? 'cloud', 'icon-sm')}<span>${esc(t(`report.${type}`))}</span><strong>${count}</strong></li>`);

  let body = `<ul class="reports">${list.map((report) => reportRow(ctx, report)).join('')}</ul>`;
  if (reports.failed) body = `<p class="sub">${esc(t('people.failed'))}</p>`;
  else if (reports.loading && !list.length) body = `<p class="sub" role="status">${esc(t('people.loading'))}</p>`;
  else if (!list.length) body = `<p class="sub">${esc(t('people.empty'))}</p>`;

  return `
    ${screenHead(ctx, location, 'people.title')}
    <div class="screen-controls">
      <button class="primary-button wide" data-action="open-sheet" data-sheet="report">${icon('megaphone')}${esc(t('people.new'))}</button>
    </div>
    <div class="cards">
      ${summary.length ? `<section class="card"><ul class="report-summary">${summary.join('')}</ul></section>` : ''}
      <section class="card">
        <h2>${esc(t('people.lead'))}</h2>
        ${body}
      </section>
    </div>
    <p class="screen-note">${esc(t('people.note'))}</p>`;
}

function sheetTop(t, titleKey) {
  return `
    <div class="sheet-head">
      <h2>${esc(t(titleKey))}</h2>
      <button class="icon-button" data-action="close-sheet" aria-label="${esc(t('action.close'))}">${icon('close')}</button>
    </div>`;
}

export function renderReportSheet(ctx) {
  const { t, draft, prefs } = ctx;
  const types = Object.keys(REPORT_ICONS).map((type) => `
    <button class="report-type" data-action="pick-report" data-id="${type}" aria-pressed="${draft.type === type}">
      ${icon(REPORT_ICONS[type])}<span>${esc(t(`report.${type}`))}</span>
    </button>`);
  return `
    ${sheetTop(t, 'people.sheet')}
    <div class="sheet-body">
      <div class="report-types">${types.join('')}</div>
      <label class="field">
        <span>${esc(t('people.noteField'))}</span>
        <input id="report-note" type="text" maxlength="140" autocomplete="off" value="${esc(draft.note)}">
      </label>
      <label class="field">
        <span>${esc(t('people.nameField'))}</span>
        <input id="report-name" type="text" maxlength="24" autocomplete="off" value="${esc(prefs.displayName)}">
      </label>
      <button class="primary-button wide" data-action="post-report" ${draft.posting ? 'disabled' : ''}>${esc(t('people.post'))}</button>
      <p id="report-status" class="sub" role="status">${esc(draft.message ?? '')}</p>
      <p class="sub">${esc(t('people.note'))}</p>
    </div>`;
}

export function renderAlertsSheet(ctx) {
  const { t, wx, prefs, lang, notifyBlocked } = ctx;
  const alerts = wx ? buildAlerts(wx, prefs.thresholds) : [];
  const history = prefs.alertLog.map((entry) => `
    <li class="alert-log" data-severity="${entry.severity}">
      ${icon(entry.icon, 'icon-sm')}
      <div>
        <span>${esc(t(`alert.${entry.id}`, formatParams(entry.params, { ...ctx, today: entry.date })))}</span>
        <small class="sub">${esc(entry.place)} · ${esc(fmtWeekday(entry.date, lang))} ${esc(entry.date.slice(8))}</small>
      </div>
    </li>`);

  return `
    ${sheetTop(t, 'alerts.title')}
    <div class="sheet-body">
      <h3>${esc(t('alerts.now'))}</h3>
      ${alerts.length ? `<ul>${alertRows({ ...ctx, today: wx.current.time.slice(0, 10) }, alerts)}</ul>` : `<p class="all-clear">${icon('check')}<span>${esc(t('alerts.noneNow'))}</span></p>`}
      <p class="sub">${esc(t('alerts.note'))}</p>
      <label class="switch-row">
        <span><strong>${esc(t('alerts.notify'))}</strong><small class="sub">${esc(t(notifyBlocked ? 'alerts.notifyBlocked' : 'alerts.notifyHint'))}</small></span>
        <input type="checkbox" data-action="toggle-notify" ${prefs.notifications ? 'checked' : ''}>
      </label>
      <h3>${esc(t('alerts.history'))}</h3>
      ${history.length ? `<ul>${history.join('')}</ul>` : `<p class="sub">${esc(t('alerts.noHistory'))}</p>`}
    </div>`;
}

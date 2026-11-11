// Member 1: the Home screen. Every function takes a context object and returns an
// HTML string with no DOM access, which lets the tests render the page in Node.
import { daylightMinutes, goldenHourStart, moonPhase } from './astro.js';
import { lineChart, moonSvg, ring } from './charts.js';
import {
  aqiBand, compassPoint, dateOf, esc, fmtClock, fmtHour, fmtLongDate, fmtRelativeDay, fmtTemp,
  fmtVisibility, fmtWeekday, fmtWind, formatParams, hourOf, minutesOf, toUnitTemp, uvBand,
} from './format.js';
import { icon } from './icons.js';
import { buildAlerts, buildInsights, firstRain, sprayWindow } from './insights.js';
import { dayParts, headline, rateActivities, wearAdvice } from './lifestyle.js';
import { rankCards } from './personas.js';
import { describeCode, skyFor } from './weather-codes.js';

const IMD_WARNINGS_URL = 'https://mausam.imd.gov.in/';
const MAX_INSIGHTS = 4;

export const LEVEL_COLOR = {
  great: 'var(--good)',
  good: 'var(--accent)',
  fair: 'var(--watch)',
  poor: 'var(--warn)',
};

export const AQI_COLOR = {
  good: '#37c47d',
  moderate: '#e8c22e',
  sensitive: '#ee8a2c',
  unhealthy: '#e5534b',
  veryUnhealthy: '#a35fc7',
  hazardous: '#8b2f4b',
};

export function greetingKey(hour) {
  if (hour >= 5 && hour < 12) return 'greeting.morning';
  if (hour >= 12 && hour < 17) return 'greeting.afternoon';
  if (hour >= 17 && hour < 22) return 'greeting.evening';
  return 'greeting.night';
}

export function ageLabel(fetchedAt, t, now = Date.now()) {
  const minutes = Math.floor((now - fetchedAt) / 60000);
  if (minutes < 1) return t('status.justNow');
  if (minutes < 60) return t('status.minsAgo', { n: minutes });
  return t('status.hoursAgo', { n: Math.floor(minutes / 60) });
}

export function fillContext(baseCtx) {
  const { wx } = baseCtx;
  return wx ? { ...baseCtx, today: dateOf(wx.current.time) } : baseCtx;
}

function topBar(ctx, location) {
  const { t, alertCount = 0 } = ctx;
  return `
    <div class="hero-top">
      <button class="place-button" data-action="open-sheet" data-sheet="locations"
        aria-label="${esc(t('hero.changeLocation', { name: location.name }))}">
        ${icon('pin')}<span>${esc(location.name)}</span>${icon('chevron', 'icon-sm')}
      </button>
      <div class="top-actions">
        <button class="icon-button" data-action="open-sheet" data-sheet="alerts" aria-label="${esc(t('hero.alerts'))}">
          ${icon('bell')}${alertCount ? `<span class="dot">${alertCount}</span>` : ''}
        </button>
        <button class="icon-button" data-action="open-sheet" data-sheet="settings"
          aria-label="${esc(t('hero.settings'))}">${icon('gear')}</button>
      </div>
    </div>`;
}

function placeChips(prefs) {
  if (prefs.locations.length < 2) return '';
  const chips = prefs.locations.map((place) => `
    <button class="chip" data-action="select-location" data-id="${esc(place.id)}"
      aria-pressed="${place.id === prefs.activeLocationId}">${esc(place.name)}</button>`);
  return `<div class="chips">${chips.join('')}</div>`;
}

function quickStats(ctx) {
  const { wx, t, units } = ctx;
  const { current, daily, air } = wx;
  const stats = [
    { label: t('stat.rain'), value: `${wx.hourly[0].pop}%`, name: 'drop' },
    { label: t('stat.humidity'), value: `${Math.round(current.humidity)}%`, name: 'drop' },
    { label: t('stat.wind'), value: fmtWind(current.windKmh, units.wind), name: 'wind' },
    { label: t('stat.uv'), value: String(Math.round(daily[0].uvMax)), name: 'sun' },
  ];
  if (air) stats.push({ label: t('stat.aqi'), value: String(air.aqi), name: 'lungs' });
  return `<dl class="stats">${stats.map((stat) => `
    <div>${icon(stat.name)}<dd>${esc(stat.value)}</dd><dt>${esc(stat.label)}</dt></div>`).join('')}</dl>`;
}

function renderHero(ctx, location) {
  const { wx, t, prefs, lang, units, speaking } = ctx;

  if (!wx) {
    return `
      <header class="hero">
        ${topBar(ctx, location)}
        <p class="hero-loading" role="status">${esc(t('status.loading'))}</p>
      </header>`;
  }

  const { current, daily } = wx;
  const condition = describeCode(current.code, current.isDay);
  const greeting = t(greetingKey(hourOf(current.time)));
  const name = prefs.name.trim();
  const summary = headline(wx, prefs.thresholds);

  return `
    <header class="hero">
      ${topBar(ctx, location)}
      ${placeChips(prefs)}
      <p class="hero-greeting">${esc(name ? `${greeting}, ${name}` : greeting)}</p>
      <p class="hero-date">${esc(fmtLongDate(current.time, lang))}</p>
      <div class="hero-main">
        <p class="hero-temp">${fmtTemp(current.temp, units.temp)}</p>
        ${icon(condition.icon, 'hero-icon')}
      </div>
      <p class="hero-condition">${esc(t(`wx.${condition.key}`))}</p>
      <p class="hero-meta">
        <span>${esc(t('hero.feels', { temp: fmtTemp(current.feels, units.temp) }))}</span>
        <span>${esc(t('hero.high', { temp: fmtTemp(daily[0].max, units.temp) }))}</span>
        <span>${esc(t('hero.low', { temp: fmtTemp(daily[0].min, units.temp) }))}</span>
      </p>
      <p class="hero-summary">${esc(t(summary.key, formatParams(summary.params, ctx)))}</p>
      ${quickStats(ctx)}
      <div class="hero-actions">
        <button data-action="speak">${icon(speaking ? 'stop' : 'speaker')}<span>${esc(t(speaking ? 'hero.stop' : 'hero.listen'))}</span></button>
        <button data-action="share">${icon('share')}<span>${esc(t('hero.share'))}</span></button>
        <button data-action="open-sheet" data-sheet="report">${icon('megaphone')}<span>${esc(t('hero.report'))}</span></button>
      </div>
      <p class="hero-updated">${esc(t('status.updated', { age: ageLabel(wx.fetchedAt, t) }))}${wx.models > 1 ? ` · ${esc(t('status.blended', { n: wx.models }))}` : ''}</p>
    </header>`;
}

function renderStatus(ctx) {
  const { status, t, wx } = ctx;
  if (status === 'demo' || status === 'offline') {
    const text = status === 'demo'
      ? t('status.demo')
      : t('status.offline', { age: ageLabel(wx.fetchedAt, t) });
    return `
      <div class="notice" role="status">
        <p>${esc(text)}</p>
        <button class="text-button" data-action="retry">${esc(t('action.retry'))}</button>
      </div>`;
  }
  return '';
}

export function alertRows(ctx, alerts) {
  const { t } = ctx;
  return alerts.map((alert) => `
    <li class="alert" data-severity="${alert.severity}">
      ${icon(alert.icon)}
      <span>${esc(t(`alert.${alert.id}`, formatParams(alert.params, ctx)))}</span>
    </li>`).join('');
}

function renderAlerts(ctx, alerts) {
  if (!alerts.length) return '';
  const { t } = ctx;
  return `
    <section class="alerts" aria-label="${esc(t('settings.alerts'))}">
      <ul>${alertRows(ctx, alerts)}</ul>
      <p class="alerts-note">
        ${esc(t('alerts.note'))}
        <a href="${IMD_WARNINGS_URL}" target="_blank" rel="noopener">${esc(t('alerts.official'))}</a>
      </p>
    </section>`;
}

function cardShell(ctx, id, why, body) {
  const { t } = ctx;
  return `
    <section class="card" data-card="${id}" aria-labelledby="card-${id}">
      <h2 id="card-${id}">${esc(t(`card.${id}`))}</h2>
      ${why ? `<p class="why">${esc(t(why))}</p>` : ''}
      ${body}
    </section>`;
}

function forYouCard(ctx) {
  const { t, insights } = ctx;
  const rows = insights.slice(0, MAX_INSIGHTS).map((item) => `
    <li class="insight" data-severity="${item.severity}">
      <span class="insight-icon">${icon(item.icon)}</span>
      <div>
        <h3>${esc(t(item.titleKey))}</h3>
        <p>${esc(t(item.bodyKey, formatParams(item.params, ctx)))}</p>
      </div>
    </li>`);
  return `<ul class="insights">${rows.join('')}</ul>`;
}

function wearCard(ctx) {
  const { wx, t } = ctx;
  const items = wearAdvice(wx);
  if (!items.length) return `<p class="sub">${esc(t('wear.none'))}</p>`;
  return `<ul class="wear">${items.map((item) => `
    <li>${icon(item.icon)}<span>${esc(t(`wear.${item.id}`))}</span></li>`).join('')}</ul>`;
}

const HOURLY_METRICS = {
  temp: { value: (h) => h.temp, label: (h, units) => `${toUnitTemp(h.temp, units.temp)}°` },
  rain: { value: (h) => h.pop, label: (h) => `${h.pop}%` },
  wind: { value: (h) => h.windKmh, label: (h) => String(Math.round(h.windKmh)) },
  humidity: { value: (h) => h.humidity ?? 0, label: (h) => `${Math.round(h.humidity ?? 0)}%` },
};

function hourlyCard(ctx) {
  const { wx, t, lang, units, ui } = ctx;
  const metricId = ui?.metric ?? 'temp';
  const metric = HOURLY_METRICS[metricId];
  const hours = wx.hourly.slice(0, 24);
  const column = 62;
  const height = 74;
  const values = hours.map(metric.value);
  const low = Math.min(...values);
  const span = Math.max(Math.max(...values) - low, 1);
  const point = (value, i) => ({
    x: i * column + column / 2,
    y: height - 12 - ((value - low) / span) * (height - 38),
  });
  const line = hours.map((h, i) => {
    const { x, y } = point(values[i], i);
    return `${x},${y.toFixed(1)}`;
  }).join(' ');
  const labels = hours.map((h, i) => {
    const { x, y } = point(values[i], i);
    return `<circle cx="${x}" cy="${y.toFixed(1)}" r="3"/><text x="${x}" y="${(y - 10).toFixed(1)}">${metric.label(h, units)}</text>`;
  }).join('');
  const tops = hours.map((h, i) => `
    <div class="hour">
      <span class="hour-time">${esc(i === 0 ? t('hour.now') : fmtHour(h.time, lang))}</span>
      ${icon(describeCode(h.code, h.isDay).icon)}
    </div>`);
  const tabs = Object.keys(HOURLY_METRICS).map((id) => `
    <button data-action="set-metric" data-id="${id}" aria-pressed="${id === metricId}">${esc(t(`metric.${id}`))}</button>`);

  return `
    <div class="pills">${tabs.join('')}</div>
    <div class="hourly-scroll" tabindex="0" role="group" aria-label="${esc(t('card.hourly'))}">
      <div class="hourly-track" style="width:${column * hours.length}px">
        <div class="hour-row">${tops.join('')}</div>
        <svg class="hourly-curve" viewBox="0 0 ${column * hours.length} ${height}"
          width="${column * hours.length}" height="${height}" aria-hidden="true">
          <polyline points="${line}"/>${labels}
        </svg>
      </div>
    </div>
    <ul class="parts">${dayParts(wx).map((part) => `
      <li>
        <span class="sub">${esc(t(`part.${part.id}`))}</span>
        ${icon(describeCode(part.code, part.isDay).icon)}
        <strong>${fmtTemp(part.temp, units.temp)}</strong>
        <span class="part-pop">${part.pop >= 20 ? `${part.pop}%` : ''}</span>
      </li>`).join('')}</ul>`;
}

function dailyCard(ctx) {
  const { wx, t, lang, units, today, ui } = ctx;
  const showAll = ui?.allDays;
  const days = wx.daily.slice(0, showAll ? 14 : 7);
  const low = Math.min(...days.map((d) => d.min));
  const span = Math.max(Math.max(...days.map((d) => d.max)) - low, 1);

  const rows = days.map((day) => {
    const left = ((day.min - low) / span) * 100;
    const width = Math.max(((day.max - day.min) / span) * 100, 4);
    const label = day.date === today ? t('day.today') : fmtWeekday(day.date, lang);
    return `
      <li><button class="day" data-action="open-day" data-date="${day.date}">
        <span class="day-name">${esc(label)}</span>
        ${icon(describeCode(day.code).icon)}
        <span class="day-pop">${day.pop >= 20 ? `${day.pop}%` : ''}</span>
        <span class="day-low">${fmtTemp(day.min, units.temp)}</span>
        <span class="range"><span style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span></span>
        <span class="day-high">${fmtTemp(day.max, units.temp)}</span>
      </button></li>`;
  });
  const toggle = wx.daily.length > 7
    ? `<button class="link-button" data-action="toggle-days">${esc(t(showAll ? 'daily.less' : 'daily.more'))}</button>`
    : '';
  return `<ul class="days">${rows.join('')}</ul>${toggle}`;
}

function activitiesCard(ctx) {
  const { wx, t, lang } = ctx;
  const rows = rateActivities(wx).map((item) => `
    <li>
      ${ring({ value: item.score, size: 54, stroke: 6, color: LEVEL_COLOR[item.level], label: String(item.score) })}
      <div>
        <strong>${esc(t(`act.${item.id}`))}</strong>
        <small>${esc(item.time ? t('act.bestAt', { at: fmtHour(item.time, lang) }) : t('act.none'))}</small>
      </div>
    </li>`);
  return `<ul class="activities">${rows.join('')}</ul>`;
}

function rainCard(ctx) {
  const { wx, t, lang, prefs } = ctx;
  const hours = wx.hourly.slice(0, 24);
  const start = firstRain(wx.hourly, prefs.thresholds.rain);
  const total = Math.round(hours.reduce((mm, h) => mm + h.precipMm, 0));

  const bars = hours.map((h) => `
    <span class="bar" style="height:${Math.max(h.pop, 3)}%" data-wet="${h.pop >= 50}"></span>`);
  const ticks = [0, 6, 12, 18].map((i) => `
    <span>${esc(i === 0 ? t('hour.now') : fmtHour(hours[i]?.time ?? hours[0].time, lang))}</span>`);

  return `
    <p class="lead">${esc(start ? t('rain.from', { at: fmtHour(start.time, lang) }) : t('rain.none'))}</p>
    ${total > 0 ? `<p class="sub">${esc(t('rain.total', { mm: total }))}</p>` : ''}
    <div class="bars" role="img" aria-label="${esc(t('rain.chart'))}">${bars.join('')}</div>
    <div class="bar-ticks" aria-hidden="true">${ticks.join('')}</div>`;
}

function airCard(ctx) {
  const { wx, t } = ctx;
  if (!wx.air) return `<p class="sub">${esc(t('air.unavailable'))}</p>`;
  const { aqi, pm25, pm10 } = wx.air;
  const band = aqiBand(aqi);
  return `
    <div class="metric-row">
      ${ring({ value: aqi, max: 300, size: 76, stroke: 8, color: AQI_COLOR[band], label: String(aqi) })}
      <div>
        <p class="lead">${esc(t(`aqi.${band}`))}</p>
        <p class="sub">${esc(t('air.scale'))} · PM2.5 ${Math.round(pm25)} · PM10 ${Math.round(pm10)}</p>
      </div>
    </div>`;
}

function sunCard(ctx) {
  const { wx, t, lang } = ctx;
  const { sunrise, sunset, uvMax } = wx.daily[0];
  const now = minutesOf(wx.current.time);
  const rise = minutesOf(sunrise);
  const set = minutesOf(sunset);
  const progress = Math.min(Math.max((now - rise) / (set - rise), 0), 1);
  const isUp = now >= rise && now <= set;
  const angle = Math.PI * (1 - progress);
  const x = 100 + 90 * Math.cos(angle);
  const y = 80 - 70 * Math.sin(angle);

  return `
    <svg class="sun-arc" viewBox="0 0 200 92" aria-hidden="true">
      <path class="sun-track" d="M10 80A90 70 0 0 1 190 80"/>
      ${progress > 0 ? `<path class="sun-done" pathLength="100" stroke-dasharray="${(progress * 100).toFixed(1)} 100" d="M10 80A90 70 0 0 1 190 80"/>` : ''}
      <path class="sun-horizon" d="M0 80H200"/>
      ${isUp ? `<circle class="sun-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7"/>` : ''}
    </svg>
    <dl class="pairs pairs-3">
      <div><dt>${esc(t('sun.sunrise'))}</dt><dd>${esc(fmtClock(sunrise, lang))}</dd></div>
      <div><dt>${esc(t('sun.sunset'))}</dt><dd>${esc(fmtClock(sunset, lang))}</dd></div>
      <div><dt>${esc(t('sun.uvToday'))}</dt><dd>${Math.round(uvMax)} · ${esc(t(`uv.${uvBand(uvMax)}`))}</dd></div>
    </dl>`;
}

function moonCard(ctx) {
  const { wx, t, lang, today } = ctx;
  const moon = moonPhase(today);
  const { sunrise, sunset } = wx.daily[0];
  const minutes = daylightMinutes(sunrise, sunset);
  return `
    <div class="moon-row">
      ${moonSvg(moon.fraction)}
      <div>
        <p class="lead">${esc(t(`moon.${moon.name}`))}</p>
        <p class="sub">${esc(t('moon.lit', { pct: moon.illumination }))}</p>
      </div>
    </div>
    <dl class="pairs">
      <div><dt>${esc(t('moon.daylight'))}</dt><dd>${esc(t('moon.daylightValue', { h: Math.floor(minutes / 60), m: minutes % 60 }))}</dd></div>
      <div><dt>${esc(t('moon.golden'))}</dt><dd>${esc(fmtClock(goldenHourStart(sunset), lang))}</dd></div>
    </dl>`;
}

function windCard(ctx) {
  const { wx, t, units } = ctx;
  const { windKmh, gustKmh, windDir } = wx.current;
  const direction = t(`dir.${compassPoint(windDir)}`);
  return `
    <div class="wind">
      <svg class="compass" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44"/>
        <text x="50" y="18">N</text>
        <path class="needle" transform="rotate(${(windDir + 180) % 360} 50 50)" d="M50 22l10 20H54v34h-8V42h-6z"/>
      </svg>
      <div>
        <p class="metric">${esc(fmtWind(windKmh, units.wind))}</p>
        <p class="sub">${esc(t('wind.from', { dir: direction }))}</p>
        <p class="sub">${esc(t('wind.gusts', { wind: fmtWind(gustKmh, units.wind) }))}</p>
      </div>
    </div>`;
}

function detailsCard(ctx) {
  const { wx, t } = ctx;
  const { humidity, pressure, cloud } = wx.current;
  return `
    <dl class="tiles">
      <div><dt>${esc(t('details.humidity'))}</dt><dd>${Math.round(humidity)}%</dd></div>
      <div><dt>${esc(t('details.pressure'))}</dt><dd>${Math.round(pressure)} hPa</dd></div>
      <div><dt>${esc(t('details.visibility'))}</dt><dd>${esc(fmtVisibility(wx.hourly[0].visibility))}</dd></div>
      <div><dt>${esc(t('details.cloud'))}</dt><dd>${Math.round(cloud)}%</dd></div>
    </dl>`;
}

function farmCard(ctx) {
  const { wx, t, lang, today } = ctx;
  const nextDays = wx.daily.slice(0, 3);
  const rain = Math.round(nextDays.reduce((mm, d) => mm + d.precipMm, 0));
  const loss = Math.round(nextDays.reduce((mm, d) => mm + d.et0, 0));
  const soil = wx.hourly[0].soil;
  const spray = sprayWindow(wx.hourly);
  const sprayText = spray
    ? `${fmtRelativeDay(dateOf(spray.from), today, t, lang)}, ${fmtHour(spray.from, lang)}–${fmtHour(spray.to, lang)}`
    : t('farm.noWindow');
  return `
    <dl class="tiles">
      <div><dt>${esc(t('farm.soil'))}</dt><dd>${soil == null ? '–' : `${Math.round(soil * 100)}%`}</dd></div>
      <div><dt>${esc(t('farm.rain3'))}</dt><dd>${rain} mm</dd></div>
      <div><dt>${esc(t('farm.loss'))}</dt><dd>${loss} mm</dd></div>
      <div><dt>${esc(t('farm.spray'))}</dt><dd>${esc(sprayText)}</dd></div>
    </dl>
    <a class="link-button" href="#/farm">${esc(t('link.openFarm'))}${icon('arrow', 'icon-sm')}</a>`;
}

export function reportRow(ctx, report) {
  const { t, prefs } = ctx;
  const confirmed = prefs.confirmed.includes(report.id);
  const age = ageLabel(report.at, t);
  return `
    <li class="report" data-type="${esc(report.type)}">
      <div class="report-main">
        <strong>${esc(t(`report.${report.type}`))}</strong>
        <small>${esc(report.name || t('people.anon'))} · ${esc(t('people.ago', { age, km: report.km ?? 0 }))}</small>
        ${report.note ? `<p>${esc(report.note)}</p>` : ''}
      </div>
      <button class="confirm" data-action="confirm-report" data-id="${esc(report.id)}" ${confirmed ? 'disabled' : ''}
        aria-label="${esc(t(confirmed ? 'people.confirmed' : 'people.confirm'))}">
        ${icon('thumb', 'icon-sm')}<span>${report.confirms}</span>
      </button>
    </li>`;
}

function communityCard(ctx) {
  const { t, reports } = ctx;
  const list = reports?.list ?? [];
  const body = list.length
    ? `<ul class="reports">${list.slice(0, 3).map((report) => reportRow(ctx, report)).join('')}</ul>`
    : `<p class="sub">${esc(t(reports?.failed ? 'people.failed' : 'people.empty'))}</p>`;
  return `${body}<a class="link-button" href="#/community">${esc(t('link.openPeople'))}${icon('arrow', 'icon-sm')}</a>`;
}

const CARD_RENDERERS = {
  forYou: forYouCard,
  wear: wearCard,
  hourly: hourlyCard,
  daily: dailyCard,
  activities: activitiesCard,
  rain: rainCard,
  air: airCard,
  community: communityCard,
  sun: sunCard,
  moon: moonCard,
  wind: windCard,
  details: detailsCard,
  farm: farmCard,
};

export function renderHome(baseCtx, location) {
  const { wx, prefs, t } = baseCtx;
  if (!wx) return renderHero(baseCtx, location);

  const alerts = buildAlerts(wx, prefs.thresholds);
  const ctx = {
    ...fillContext(baseCtx),
    alertCount: alerts.length,
    insights: buildInsights(wx, prefs.personas, prefs.thresholds),
  };
  const cards = rankCards(prefs, wx).visible.map(({ id, why }) =>
    cardShell(ctx, id, why, CARD_RENDERERS[id](ctx)));

  return `
    ${renderHero(ctx, location)}
    ${renderStatus(ctx)}
    ${renderAlerts(ctx, alerts)}
    <div class="cards">${cards.join('')}</div>
    <footer class="footer">
      <button class="wide-button" data-action="open-sheet" data-sheet="customize">${esc(t('action.customize'))}</button>
      <p>${esc(t('footer.source'))}</p>
      <p>${esc(t('footer.note'))}</p>
    </footer>`;
}

// Day detail sheet: opened by tapping a row in the forecast.
export function renderDaySheet(ctx, date) {
  const { wx, t, lang, units, today } = fillContext(ctx);
  const day = wx.daily.find((d) => d.date === date);
  const hours = wx.hourly.filter((h) => dateOf(h.time) === date);
  const title = date === today ? t('day.today') : fmtLongDate(date, lang);
  const condition = describeCode(day.code);

  const chart = hours.length > 2
    ? lineChart({
      id: 'day-temp',
      series: [{ values: hours.map((h) => toUnitTemp(h.temp, units.temp)), color: 'var(--accent)', fill: true }],
      labels: hours.flatMap((h, index) => (index % 6 === 0 ? [{ index, text: esc(fmtHour(h.time, lang)) }] : [])),
      ariaLabel: esc(t('day.tempChart')),
      format: (v) => `${Math.round(v)}°`,
    })
    : `<p class="sub">${esc(t('day.noHours'))}</p>`;

  const rows = hours.filter((h, i) => i % 2 === 0).map((h) => `
    <li>
      <span>${esc(fmtHour(h.time, lang))}</span>
      ${icon(describeCode(h.code, h.isDay).icon)}
      <strong>${fmtTemp(h.temp, units.temp)}</strong>
      <span class="day-pop">${h.pop}%</span>
      <span class="sub">${esc(fmtWind(h.windKmh, units.wind))}</span>
    </li>`);

  return `
    <div class="sheet-head">
      <h2>${esc(title)}</h2>
      <button class="icon-button" data-action="close-sheet" aria-label="${esc(t('action.close'))}">${icon('close')}</button>
    </div>
    <div class="sheet-body">
      <div class="metric-row">
        ${icon(condition.icon, 'icon-lg')}
        <div>
          <p class="lead">${esc(t(`wx.${condition.key}`))}</p>
          <p class="sub">${fmtTemp(day.min, units.temp)} – ${fmtTemp(day.max, units.temp)}</p>
        </div>
      </div>
      <dl class="tiles">
        <div><dt>${esc(t('day.rainTotal'))}</dt><dd>${Math.round(day.precipMm)} mm · ${day.pop}%</dd></div>
        <div><dt>${esc(t('day.windMax'))}</dt><dd>${esc(fmtWind(day.windMax, units.wind))}</dd></div>
        <div><dt>${esc(t('sun.sunrise'))}</dt><dd>${esc(fmtClock(day.sunrise, lang))}</dd></div>
        <div><dt>${esc(t('sun.sunset'))}</dt><dd>${esc(fmtClock(day.sunset, lang))}</dd></div>
      </dl>
      <h3>${esc(t('day.title'))}</h3>
      ${chart}
      <ul class="hour-list">${rows.join('')}</ul>
    </div>`;
}

export function renderShareData(ctx, location) {
  const { wx, t, units, lang, prefs } = fillContext(ctx);
  const condition = describeCode(wx.current.code, wx.current.isDay);
  const summary = headline(wx, prefs.thresholds);
  return {
    sky: skyFor(wx),
    place: location.name,
    temp: fmtTemp(wx.current.temp, units.temp),
    condition: t(`wx.${condition.key}`),
    range: `${t('hero.high', { temp: fmtTemp(wx.daily[0].max, units.temp) })}  ${t('hero.low', { temp: fmtTemp(wx.daily[0].min, units.temp) })}`,
    summary: t(summary.key, formatParams(summary.params, { ...ctx, lang, units, today: dateOf(wx.current.time) })),
    date: fmtLongDate(wx.current.time, lang),
  };
}

export function briefingText(ctx, location) {
  const { wx, t, units, prefs } = ctx;
  const full = fillContext(ctx);
  const condition = describeCode(wx.current.code, wx.current.isDay);
  const insights = buildInsights(wx, prefs.personas, prefs.thresholds);
  const summary = headline(wx, prefs.thresholds);
  const greeting = t(greetingKey(hourOf(wx.current.time)));
  const name = prefs.name.trim();
  const items = wearAdvice(wx).map((item) => t(`wear.${item.id}`));
  const parts = [
    t('voice.intro', {
      greeting: name ? `${greeting}, ${name}` : greeting,
      place: location.name,
      temp: fmtTemp(wx.current.temp, units.temp),
      cond: t(`wx.${condition.key}`),
    }),
    t('voice.range', { high: fmtTemp(wx.daily[0].max, units.temp), low: fmtTemp(wx.daily[0].min, units.temp) }),
    t(summary.key, formatParams(summary.params, full)),
    ...insights.slice(0, 2).map((item) => t(item.bodyKey, formatParams(item.params, full))),
  ];
  if (items.length) parts.push(t('voice.carry', { items: items.slice(0, 4).join(', ') }));
  return parts.join(' ');
}

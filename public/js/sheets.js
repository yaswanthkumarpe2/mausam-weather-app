// Markup for the first-run setup and the bottom sheets. Strings only, no DOM.
import { BADGES, earnedBadges } from './achievements.js';
import { esc, fmtTemp, fmtWind } from './format.js';
import { icon } from './icons.js';
import { PERSONAS, hiddenCards, rankCards } from './personas.js';

export const POPULAR_CITIES = [
  { name: 'Delhi', lat: 28.61, lon: 77.21 },
  { name: 'Mumbai', lat: 19.08, lon: 72.88 },
  { name: 'Bengaluru', lat: 12.97, lon: 77.59 },
  { name: 'Hyderabad', lat: 17.39, lon: 78.49 },
  { name: 'Chennai', lat: 13.08, lon: 80.27 },
  { name: 'Kolkata', lat: 22.57, lon: 88.36 },
];

const THRESHOLDS = [
  { id: 'rain', label: 'settings.alertRain', min: 30, max: 90, step: 10 },
  { id: 'heat', label: 'settings.alertHeat', min: 30, max: 48, step: 1 },
  { id: 'wind', label: 'settings.alertWind', min: 20, max: 80, step: 5 },
  { id: 'aqi', label: 'settings.alertAqi', min: 50, max: 300, step: 25 },
];

export function thresholdLabel(id, value, units) {
  if (id === 'rain') return `${value}%`;
  if (id === 'heat') return fmtTemp(value, units.temp);
  if (id === 'wind') return fmtWind(value, units.wind);
  return String(value);
}

function segmented(name, options, selected) {
  const buttons = options.map(({ value, label }) => `
    <button data-action="set-pref" data-pref="${name}" data-value="${value}"
      aria-pressed="${value === selected}">${esc(label)}</button>`);
  return `<div class="segmented">${buttons.join('')}</div>`;
}

const languagePicker = (prefs) => segmented('lang', [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
], prefs.lang);

function personaPicker({ t, prefs }) {
  const rows = PERSONAS.map(({ id, icon: name }) => {
    const selected = prefs.personas.includes(id);
    return `
      <button class="persona" data-action="toggle-persona" data-id="${id}" aria-pressed="${selected}">
        <span class="persona-icon">${icon(name)}</span>
        <span>
          <strong>${esc(t(`persona.${id}.name`))}</strong>
          <small>${esc(t(`persona.${id}.desc`))}</small>
        </span>
        <span class="persona-check">${selected ? icon('check') : ''}</span>
      </button>`;
  });
  return `<div class="personas">${rows.join('')}</div>`;
}

function placePicker({ t }, showPopular) {
  const popular = POPULAR_CITIES.map((city, index) => `
    <button class="chip chip-plain" data-action="add-popular" data-index="${index}">${esc(city.name)}</button>`);
  return `
    <label class="search">
      ${icon('search')}
      <input id="place-search" type="search" autocomplete="off" placeholder="${esc(t('locations.search'))}"
        aria-label="${esc(t('locations.search'))}">
    </label>
    <div id="place-results" aria-live="polite"></div>
    <button class="wide-button" data-action="use-gps">${icon('locate')}${esc(t('locations.gps'))}</button>
    <p id="gps-status" class="sub" role="status"></p>
    ${showPopular ? `<h3>${esc(t('locations.popular'))}</h3><div class="chips chips-wrap">${popular.join('')}</div>` : ''}`;
}

export function renderPlaceResults(results, t, failed) {
  if (failed) return `<p class="sub">${esc(t('locations.searchFailed'))}</p>`;
  if (!results) return '';
  if (!results.length) return `<p class="sub">${esc(t('locations.noResults'))}</p>`;
  const rows = results.map((place, index) => `
    <li><button class="result" data-action="add-result" data-index="${index}">
      <strong>${esc(place.name)}</strong><small>${esc(place.region)}</small>
    </button></li>`);
  return `<ul class="results">${rows.join('')}</ul>`;
}

export function renderOnboarding(ctx, step) {
  const { t, prefs } = ctx;
  const steps = [
    `<h1>${esc(t('ob.welcome.title'))}</h1>
     <p class="ob-body">${esc(t('ob.welcome.body'))}</p>
     <p class="field"><span>${esc(t('settings.language'))}</span></p>
     ${languagePicker(prefs)}
     <label class="field">
       <span>${esc(t('settings.name'))}</span>
       <input id="pref-name" type="text" maxlength="30" autocomplete="given-name" value="${esc(prefs.name)}">
     </label>`,
    `<h1>${esc(t('ob.interests.title'))}</h1>
     <p class="ob-body">${esc(t('ob.interests.body'))}</p>
     ${personaPicker(ctx)}`,
    `<h1>${esc(t('ob.location.title'))}</h1>
     <p class="ob-body">${esc(t('ob.location.body'))}</p>
     ${placePicker(ctx, true)}`,
  ];

  return `
    <div class="onboarding">
      <div class="ob-brand">${icon('partly')}<span>Mausam</span></div>
      <p class="ob-step">${esc(t('ob.step', { n: step + 1 }))}</p>
      <div class="ob-content">${steps[step]}</div>
      <div class="ob-actions">
        ${step > 0 ? `<button class="text-button" data-action="ob-back">${esc(t('action.back'))}</button>` : '<span></span>'}
        ${step < 2 ? `<button class="primary-button" data-action="ob-next">${esc(t('action.next'))}</button>` : ''}
      </div>
    </div>`;
}

function sheetFrame({ t }, titleKey, body) {
  return `
    <div class="sheet-head">
      <h2>${esc(t(titleKey))}</h2>
      <button class="icon-button" data-action="close-sheet" aria-label="${esc(t('action.close'))}">${icon('close')}</button>
    </div>
    <div class="sheet-body">${body}</div>`;
}

function locationsSheet(ctx) {
  const { t, prefs } = ctx;
  const saved = prefs.locations.map((place) => `
    <li class="saved-place">
      <button class="result" data-action="select-location" data-id="${esc(place.id)}"
        aria-current="${place.id === prefs.activeLocationId}">
        <strong>${esc(place.name)}</strong><small>${esc(place.region ?? '')}</small>
      </button>
      ${prefs.locations.length > 1 ? `
        <button class="icon-button" data-action="remove-location" data-id="${esc(place.id)}"
          aria-label="${esc(t('locations.remove', { name: place.name }))}">${icon('close')}</button>` : ''}
    </li>`);
  return sheetFrame(ctx, 'locations.title', `
    <ul class="results">${saved.join('')}</ul>
    ${placePicker(ctx, false)}`);
}

function badgesPanel({ t, prefs }) {
  const earned = earnedBadges(prefs.stats);
  const badges = BADGES.map(({ id, icon: name }) => `
    <li class="badge" data-earned="${earned.includes(id)}">${icon(name)}<span>${esc(t(`badge.${id}`))}</span></li>`);
  return `
    <p class="streak">${icon('flame')}<strong>${esc(t('settings.streak', { n: prefs.stats.streak }))}</strong>
      <span class="sub">${esc(t('settings.bestStreak', { n: prefs.stats.best }))}</span></p>
    <ul class="badges">${badges.join('')}</ul>`;
}

function settingsSheet(ctx) {
  const { t, prefs } = ctx;
  const { units, thresholds } = prefs;

  const sliders = THRESHOLDS.map(({ id, label, min, max, step }) => `
    <label class="slider">
      <span>${esc(t(label))} <output id="threshold-${id}">${esc(thresholdLabel(id, thresholds[id], units))}</output></span>
      <input type="range" data-threshold="${id}" min="${min}" max="${max}" step="${step}" value="${thresholds[id]}">
    </label>`);

  return sheetFrame(ctx, 'settings.title', `
    <h3>${esc(t('settings.profile'))}</h3>
    <label class="field">
      <span>${esc(t('settings.name'))}</span>
      <input id="pref-name" type="text" maxlength="30" autocomplete="given-name" value="${esc(prefs.name)}">
    </label>
    <p class="field"><span>${esc(t('settings.language'))}</span></p>
    ${languagePicker(prefs)}

    <h3>${esc(t('settings.interests'))}</h3>
    ${personaPicker(ctx)}

    <h3>${esc(t('settings.alerts'))}</h3>
    ${sliders.join('')}
    <p class="sub">${esc(t('alerts.note'))}</p>

    <h3>${esc(t('settings.theme'))}</h3>
    ${segmented('theme', [
      { value: 'auto', label: t('settings.themeAuto') },
      { value: 'light', label: t('settings.themeLight') },
      { value: 'dark', label: t('settings.themeDark') },
    ], prefs.theme)}
    <p class="field"><span>${esc(t('settings.tempUnit'))}</span></p>
    ${segmented('units.temp', [{ value: 'c', label: '°C' }, { value: 'f', label: '°F' }], units.temp)}
    <p class="field"><span>${esc(t('settings.windUnit'))}</span></p>
    ${segmented('units.wind', [{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }], units.wind)}
    <label class="switch-row">
      <span><strong>${esc(t('settings.bigText'))}</strong><small class="sub">${esc(t('settings.bigTextHint'))}</small></span>
      <input type="checkbox" data-action="toggle-big-text" ${prefs.bigText ? 'checked' : ''}>
    </label>

    <h3>${esc(t('settings.badges'))}</h3>
    ${badgesPanel(ctx)}

    <button class="wide-button danger" data-action="reset-all">${esc(t('settings.reset'))}</button>`);
}

function customizeSheet(ctx) {
  const { t, prefs, wx } = ctx;
  const { order } = rankCards(prefs, wx);
  const hidden = hiddenCards(prefs);

  const rows = order.map((id, index) => {
    const card = t(`card.${id}`);
    return `
      <li class="layout-row">
        <label class="switch">
          <input type="checkbox" data-action="toggle-card" data-id="${id}" ${hidden.includes(id) ? '' : 'checked'}
            aria-label="${esc(t('customize.toggle', { card }))}">
          <span>${esc(card)}</span>
        </label>
        <button class="icon-button" data-action="move-card" data-id="${id}" data-delta="-1"
          aria-label="${esc(t('customize.up', { card }))}" ${index === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button class="icon-button" data-action="move-card" data-id="${id}" data-delta="1"
          aria-label="${esc(t('customize.down', { card }))}" ${index === order.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
      </li>`;
  });

  return sheetFrame(ctx, 'customize.title', `
    <p class="sub">${esc(t(prefs.layout.order ? 'customize.manual' : 'customize.smart'))}</p>
    <ul class="layout-list">${rows.join('')}</ul>
    ${prefs.layout.order || prefs.layout.hidden
      ? `<button class="wide-button" data-action="reset-layout">${esc(t('customize.reset'))}</button>`
      : ''}`);
}

const SHEETS = { locations: locationsSheet, settings: settingsSheet, customize: customizeSheet };

export const renderSheet = (name, ctx) => SHEETS[name](ctx);

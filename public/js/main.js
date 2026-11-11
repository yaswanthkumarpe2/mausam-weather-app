// App controller: holds state, routes between tabs, loads data and handles actions.
import { BADGES, checkIn, earnedBadges, logAlerts } from './achievements.js';
import {
  confirmReportOnServer, fetchArchive, fetchReports, fetchRoute, fetchWeather, postReport, searchPlaces,
} from './api.js';
import { briefingText, fillContext, renderDaySheet, renderHome, renderShareData } from './cards.js';
import { demoForecast } from './demo.js';
import { dateOf, formatParams } from './format.js';
import { createT } from './i18n.js';
import { icon } from './icons.js';
import { buildAlerts } from './insights.js';
import { hiddenCards, rankCards } from './personas.js';
import { renderAlertsSheet, renderCommunity, renderReportSheet } from './screen-community.js';
import { renderFarm } from './screen-farm.js';
import { renderHealth } from './screen-health.js';
import { mountMap, renderMap, seekRadar, setMapLayer, toggleRadar, unmountMap } from './screen-map.js';
import { renderPlan } from './screen-plan.js';
import { shareCard } from './share.js';
import {
  POPULAR_CITIES, renderOnboarding, renderPlaceResults, renderSheet, thresholdLabel,
} from './sheets.js';
import { setSky } from './sky.js';
import { eraseAll, loadPrefs, readForecast, saveForecast, savePrefs } from './store.js';
import { assessTrip, bestDeparture, roadEstimate, waypoints } from './trip.js';
import { canSpeak, speak, stopSpeaking } from './voice.js';
import { skyFor } from './weather-codes.js';

const REFRESH_AFTER_MS = 30 * 60 * 1000;
const SEARCH_DELAY_MS = 300;
const FORCE_DEMO = new URLSearchParams(location.search).has('demo');
const TABS = [
  { id: 'home', icon: 'home' },
  { id: 'map', icon: 'map' },
  { id: 'farm', icon: 'leaf' },
  { id: 'health', icon: 'heart' },
  { id: 'plan', icon: 'calendar' },
  { id: 'community', icon: 'people' },
];

const app = document.querySelector('#app');
const tabs = document.querySelector('#tabs');
const sheet = document.querySelector('#sheet');
const toastEl = document.querySelector('#toast');

const state = {
  prefs: loadPrefs(),
  wx: null,
  status: 'loading', // loading | live | offline | demo
  step: 0,
  tab: 'home',
  openSheet: null,
  sheetDate: null,
  results: [],
  tripResults: [],
  loadId: 0,
  searchId: 0,
  searchTimer: 0,
  speaking: false,
  notifyBlocked: false,
  ui: { metric: 'temp', allDays: false, planSegment: 'best', planActivity: 'event' },
  reports: { list: [], loading: false, failed: false },
  draft: { type: null, note: '', posting: false, message: '' },
  trip: { to: null, date: null, hour: 8, loading: false, failed: false, needsTo: false, result: null },
  compare: { loading: false, data: {} },
  climate: { loading: false, failed: false, archive: null, placeId: null },
};

const activeLocation = () =>
  state.prefs.locations.find((place) => place.id === state.prefs.activeLocationId) ?? null;

function context() {
  const { prefs, wx, status, ui, reports, draft, trip, compare, climate, speaking, notifyBlocked } = state;
  return fillContext({
    t: createT(prefs.lang),
    lang: prefs.lang,
    units: prefs.units,
    prefs, wx, status, ui, reports, draft, trip, compare, climate, speaking, notifyBlocked,
    location: activeLocation(),
  });
}

let toastTimer = 0;

function toast(message) {
  toastEl.textContent = message;
  toastEl.dataset.show = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.dataset.show = 'false';
  }, 3200);
}

// Saves a stats change and announces any badge it unlocked.
function updateStats(change) {
  const { prefs } = state;
  const before = earnedBadges(prefs.stats);
  prefs.stats = change(prefs.stats);
  savePrefs(prefs);
  const t = createT(prefs.lang);
  for (const id of earnedBadges(prefs.stats)) {
    if (!before.includes(id) && BADGES.some((badge) => badge.id === id)) {
      toast(t('badge.earned', { name: t(`badge.${id}`) }));
    }
  }
}

function renderTabs() {
  const { prefs } = state;
  const ready = prefs.onboarded && activeLocation();
  tabs.hidden = !ready;
  if (!ready) return;
  const t = createT(prefs.lang);
  tabs.innerHTML = `
    <span class="tabs-brand">${icon('partly')}Mausam</span>
    ${TABS.map(({ id, icon: name }) => `
      <a href="#/${id}" ${id === state.tab ? 'aria-current="page"' : ''}>${icon(name)}<span>${t(`nav.${id}`)}</span></a>`).join('')}`;
}

const SCREENS = {
  home: renderHome,
  map: renderMap,
  farm: renderFarm,
  health: renderHealth,
  plan: renderPlan,
  community: renderCommunity,
};

function render() {
  const { prefs, step, tab, wx } = state;
  const root = document.documentElement;
  root.lang = prefs.lang;
  root.dataset.bigText = String(prefs.bigText);
  if (prefs.theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = prefs.theme;
  const prefersLight = matchMedia('(prefers-color-scheme: light)').matches;
  root.dataset.mapTheme = prefs.theme === 'light' || (prefs.theme === 'auto' && prefersLight) ? 'light' : 'dark';

  setSky(wx ? skyFor(wx) : 'cloudy-day');
  renderTabs();
  unmountMap();

  const place = activeLocation();
  const ready = prefs.onboarded && place;
  document.body.dataset.tab = ready ? tab : 'setup';
  app.innerHTML = ready ? SCREENS[tab](context(), place) : renderOnboarding(context(), step);
  if (ready && tab === 'map') mountMap(context());
}

function refreshSheet(focusSelector) {
  if (!state.openSheet) return;
  const scrollTop = sheet.querySelector('.sheet-body')?.scrollTop ?? 0;
  const ctx = context();
  const content = {
    report: () => renderReportSheet(ctx),
    alerts: () => renderAlertsSheet(ctx),
    day: () => renderDaySheet(ctx, state.sheetDate),
  }[state.openSheet];
  sheet.innerHTML = content ? content() : renderSheet(state.openSheet, ctx);
  const body = sheet.querySelector('.sheet-body');
  if (body) body.scrollTop = scrollTop;
  if (focusSelector) sheet.querySelector(focusSelector)?.focus();
}

function commit(focusSelector) {
  savePrefs(state.prefs);
  render();
  refreshSheet(focusSelector);
}

function notify(entries) {
  if (!state.prefs.notifications || !('Notification' in window) || Notification.permission !== 'granted') return;
  const ctx = context();
  for (const entry of entries.slice(0, 3)) {
    const body = ctx.t(`alert.${entry.id}`, formatParams(entry.params, ctx));
    new Notification(`Mausam: ${entry.place}`, { body, icon: 'icon-192.png', tag: entry.key });
  }
}

function afterWeather() {
  const { wx, prefs } = state;
  const place = activeLocation();
  if (!wx || !place) return;
  const today = dateOf(wx.current.time);
  updateStats((stats) => checkIn({ ...stats, places: prefs.locations.length }, today));
  if (wx.source === 'demo') return;
  const { log, fresh } = logAlerts(prefs.alertLog, buildAlerts(wx, prefs.thresholds), place.name, today);
  prefs.alertLog = log;
  savePrefs(prefs);
  notify(fresh);
}

async function loadReports() {
  const place = activeLocation();
  if (!place) return;
  state.reports.loading = true;
  try {
    state.reports.list = await fetchReports(place);
    state.reports.failed = false;
  } catch {
    state.reports.failed = true;
  }
  state.reports.loading = false;
  if (state.tab === 'home' || state.tab === 'community') render();
}

async function loadWeather() {
  const place = activeLocation();
  if (!place) return;
  const loadId = ++state.loadId;
  state.compare.data = {};
  state.trip.result = null;

  if (FORCE_DEMO) {
    state.wx = demoForecast();
    state.status = 'demo';
    afterWeather();
    render();
    loadReports();
    return;
  }

  // Show the saved forecast straight away, then replace it when the fetch lands.
  const saved = readForecast(place.id);
  state.wx = saved;
  state.status = saved ? 'live' : 'loading';
  render();

  try {
    const wx = await fetchWeather(place);
    if (loadId !== state.loadId) return; // The user has switched place since.
    saveForecast(place.id, wx);
    state.wx = wx;
    state.status = 'live';
  } catch {
    if (loadId !== state.loadId) return;
    state.wx = saved ?? demoForecast();
    state.status = saved ? 'offline' : 'demo';
  }
  afterWeather();
  render();
  loadReports();
  if (state.tab === 'plan') loadPlanData();
}

function openSheet(name, date = null) {
  state.openSheet = name;
  state.sheetDate = date;
  state.results = [];
  if (name === 'report') state.draft = { type: null, note: '', posting: false, message: '' };
  refreshSheet();
  if (!sheet.open) sheet.showModal();
}

function closeSheet() {
  if (sheet.open) sheet.close();
}

function addPlace(place) {
  const id = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  const { prefs } = state;
  if (!prefs.locations.some((saved) => saved.id === id)) {
    prefs.locations.push({ ...place, id });
  }
  prefs.activeLocationId = id;
  prefs.onboarded = true;
  savePrefs(prefs);
  closeSheet();
  loadWeather();
}

function useGps() {
  const { t } = context();
  const status = document.querySelector('#gps-status');
  const fail = (key) => {
    if (status) status.textContent = t(key);
  };
  if (!navigator.geolocation) {
    fail('locations.gpsFailed');
    return;
  }
  if (status) status.textContent = t('status.loading');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => addPlace({
      name: t('locations.current'),
      // About 1 km of precision is plenty for a forecast and shares less.
      lat: Number(coords.latitude.toFixed(2)),
      lon: Number(coords.longitude.toFixed(2)),
    }),
    (error) => fail(error.code === error.PERMISSION_DENIED ? 'locations.gpsDenied' : 'locations.gpsFailed'),
    { timeout: 10000, maximumAge: 600000 },
  );
}

function runSearch(query, targetId, resultKey, action) {
  const target = document.querySelector(targetId);
  const { t } = context();
  clearTimeout(state.searchTimer);
  const searchId = ++state.searchId;

  if (query.trim().length < 2) {
    target.innerHTML = '';
    return;
  }
  state.searchTimer = setTimeout(async () => {
    try {
      const results = await searchPlaces(query.trim());
      if (searchId !== state.searchId) return;
      state[resultKey] = results;
      target.innerHTML = renderPlaceResults(results, t, false).replaceAll('data-action="add-result"', `data-action="${action}"`);
    } catch {
      if (searchId === state.searchId) target.innerHTML = renderPlaceResults(null, t, true);
    }
  }, SEARCH_DELAY_MS);
}

// The first manual change freezes the current smart order as the user's own.
function moveCard(id, delta) {
  const order = [...rankCards(state.prefs, state.wx).order];
  const from = order.indexOf(id);
  const to = from + delta;
  if (to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  state.prefs.layout.order = order;
  commit(`[data-action="move-card"][data-id="${id}"][data-delta="${delta}"]:not([disabled])`);
}

function toggleCard(id) {
  const hidden = hiddenCards(state.prefs);
  state.prefs.layout.hidden = hidden.includes(id)
    ? hidden.filter((cardId) => cardId !== id)
    : [...hidden, id];
  commit(`[data-action="toggle-card"][data-id="${id}"]`);
}

function goToStep(step) {
  state.step = step;
  render();
  window.scrollTo(0, 0);
}

function route() {
  const id = location.hash.replace('#/', '');
  state.tab = TABS.some((tab) => tab.id === id) ? id : 'home';
  closeSheet(); // The phone's back button can change tabs while a panel is open.
  render();
  window.scrollTo(0, 0);
  if (state.tab === 'community' || state.tab === 'home') loadReports();
  if (state.tab === 'plan') loadPlanData();
}

async function loadCompare() {
  const { prefs, compare } = state;
  const places = prefs.locations.slice(0, 4);
  if (places.length < 2 || places.every((place) => compare.data[place.id])) return;
  compare.loading = true;
  render();
  await Promise.all(places.map(async (place) => {
    try {
      compare.data[place.id] = await fetchWeather(place);
    } catch {
      const saved = readForecast(place.id);
      if (saved) compare.data[place.id] = saved;
    }
  }));
  compare.loading = false;
  render();
}

async function loadClimate() {
  const { climate, wx } = state;
  const place = activeLocation();
  if (!place || !wx || (climate.archive && climate.placeId === place.id)) return;
  climate.loading = true;
  climate.failed = false;
  render();
  try {
    climate.archive = await fetchArchive(place, dateOf(wx.current.time));
    climate.placeId = place.id;
  } catch {
    climate.failed = true;
  }
  climate.loading = false;
  render();
}

function loadPlanData() {
  if (state.ui.planSegment === 'compare') loadCompare();
  if (state.ui.planSegment === 'climate') loadClimate();
}

async function checkTrip() {
  const { trip, wx } = state;
  const from = activeLocation();
  if (!trip.to) {
    trip.needsTo = true;
    render();
    return;
  }
  const date = trip.date ?? dateOf(wx.current.time);
  const departure = `${date}T${String(trip.hour).padStart(2, '0')}:00`;
  const { km, hours } = roadEstimate(from, trip.to);
  Object.assign(trip, { needsTo: false, failed: false, loading: true, result: null });
  render();
  try {
    const forecasts = await fetchRoute(waypoints(from, trip.to));
    const nextHour = `${wx.current.time.slice(0, 13)}:00`;
    trip.result = {
      km,
      hours,
      names: { from: from.name, to: trip.to.name },
      assessment: assessTrip(forecasts, departure, hours),
      best: bestDeparture(forecasts, nextHour > departure ? nextHour : departure, hours),
    };
    updateStats((stats) => ({ ...stats, trips: stats.trips + 1 }));
  } catch {
    trip.failed = true;
  }
  trip.loading = false;
  render();
}

async function submitReport() {
  const { draft, prefs } = state;
  const t = createT(prefs.lang);
  const status = document.querySelector('#report-status');
  if (!draft.type) {
    status.textContent = t('people.pickType');
    return;
  }
  const place = activeLocation();
  draft.note = document.querySelector('#report-note').value;
  prefs.displayName = document.querySelector('#report-name').value;
  savePrefs(prefs);
  draft.posting = true;
  refreshSheet();
  try {
    await postReport({ type: draft.type, note: draft.note, name: prefs.displayName, place: place.name, lat: place.lat, lon: place.lon });
    closeSheet();
    toast(t('people.posted'));
    updateStats((stats) => ({ ...stats, reports: stats.reports + 1 }));
    loadReports();
  } catch {
    draft.posting = false;
    draft.message = t('people.postFailed');
    refreshSheet();
  }
}

async function confirmReport(id) {
  const { prefs, reports } = state;
  if (prefs.confirmed.includes(id)) return;
  try {
    const { report } = await confirmReportOnServer(id);
    prefs.confirmed = [...prefs.confirmed, id].slice(-200);
    savePrefs(prefs);
    reports.list = reports.list.map((item) => (item.id === id ? { ...item, confirms: report.confirms } : item));
    render();
  } catch {
    toast(createT(prefs.lang)('people.postFailed'));
  }
}

function toggleSpeech() {
  const ctx = context();
  if (!canSpeak()) {
    toast(ctx.t('voice.unsupported'));
    return;
  }
  if (state.speaking) {
    stopSpeaking();
    state.speaking = false;
    render();
    return;
  }
  state.speaking = true;
  render();
  speak(briefingText(ctx, activeLocation()), state.prefs.lang, () => {
    state.speaking = false;
    if (state.tab === 'home') render();
  });
  updateStats((stats) => ({ ...stats, briefings: stats.briefings + 1 }));
}

async function shareWeather() {
  const ctx = context();
  const place = activeLocation();
  const result = await shareCard(renderShareData(ctx, place), ctx.t('share.title', { place: place.name }));
  if (result === 'saved') toast(ctx.t('share.saved'));
}

async function toggleNotifications(input) {
  const { prefs } = state;
  if (!input.checked) {
    prefs.notifications = false;
    savePrefs(prefs);
    return;
  }
  const permission = 'Notification' in window ? await Notification.requestPermission() : 'denied';
  prefs.notifications = permission === 'granted';
  state.notifyBlocked = permission !== 'granted';
  savePrefs(prefs);
  refreshSheet();
}

const actions = {
  'open-sheet': ({ sheet: name }) => openSheet(name),
  'open-day': ({ date }) => openSheet('day', date),
  'close-sheet': closeSheet,
  retry: loadWeather,

  'ob-next': () => goToStep(state.step + 1),
  'ob-back': () => goToStep(state.step - 1),

  'set-pref': ({ pref, value }) => {
    const [group, key] = pref.split('.');
    if (key) state.prefs[group][key] = value;
    else state.prefs[group] = value;
    commit(`[data-pref="${pref}"][data-value="${value}"]`);
  },
  'toggle-persona': ({ id }) => {
    const { prefs } = state;
    prefs.personas = prefs.personas.includes(id)
      ? prefs.personas.filter((persona) => persona !== id)
      : [...prefs.personas, id];
    commit(`[data-action="toggle-persona"][data-id="${id}"]`);
  },
  'toggle-big-text': () => {
    state.prefs.bigText = !state.prefs.bigText;
    commit('[data-action="toggle-big-text"]');
  },
  'toggle-notify': (data, input) => toggleNotifications(input),

  'select-location': ({ id }) => {
    state.prefs.activeLocationId = id;
    savePrefs(state.prefs);
    closeSheet();
    loadWeather();
  },
  'remove-location': ({ id }) => {
    const { prefs } = state;
    prefs.locations = prefs.locations.filter((place) => place.id !== id);
    if (prefs.activeLocationId === id) {
      prefs.activeLocationId = prefs.locations[0].id;
      loadWeather();
    }
    commit();
  },
  'add-result': ({ index }) => addPlace(state.results[Number(index)]),
  'add-popular': ({ index }) => addPlace(POPULAR_CITIES[Number(index)]),
  'use-gps': useGps,

  'move-card': ({ id, delta }) => moveCard(id, Number(delta)),
  'toggle-card': ({ id }) => toggleCard(id),
  'reset-layout': () => {
    state.prefs.layout = { order: null, hidden: null };
    commit();
  },

  'set-metric': ({ id }) => {
    state.ui.metric = id;
    render();
  },
  'toggle-days': () => {
    state.ui.allDays = !state.ui.allDays;
    render();
  },
  speak: toggleSpeech,
  share: shareWeather,

  'set-crop': ({ id }) => {
    state.prefs.farm.crop = id;
    commit();
  },
  'set-stage': ({ id }) => {
    state.prefs.farm.stage = id;
    commit();
  },
  'toggle-condition': ({ id }) => {
    const { health } = state.prefs;
    health.conditions = health.conditions.includes(id)
      ? health.conditions.filter((item) => item !== id)
      : [...health.conditions, id];
    commit();
  },

  'set-segment': ({ id }) => {
    state.ui.planSegment = id;
    render();
    loadPlanData();
  },
  'set-activity': ({ id }) => {
    state.ui.planActivity = id;
    render();
  },
  'load-climate': loadClimate,
  'trip-pick': ({ index }) => {
    state.trip.to = state.tripResults[Number(index)];
    state.trip.needsTo = false;
    render();
  },
  'trip-clear': () => {
    Object.assign(state.trip, { to: null, result: null });
    render();
  },
  'trip-check': checkTrip,

  'pick-report': ({ id }) => {
    state.draft.type = id;
    state.draft.note = document.querySelector('#report-note')?.value ?? '';
    refreshSheet();
  },
  'post-report': submitReport,
  'confirm-report': ({ id }) => confirmReport(id),

  'map-layer': ({ id }) => setMapLayer(id, context()),
  'radar-toggle': () => toggleRadar(context()),
  'map-save': ({ lat, lon, name }) => addPlace({
    name: name || createT(state.prefs.lang)('map.pin'),
    lat: Number(lat),
    lon: Number(lon),
  }),

  'reset-all': () => {
    if (!confirm(context().t('settings.resetConfirm'))) return;
    eraseAll();
    location.hash = '';
    location.reload();
  },
};

document.addEventListener('click', (event) => {
  if (event.target === sheet) {
    closeSheet(); // A click on the backdrop lands on the dialog element itself.
    return;
  }
  const trigger = event.target.closest('[data-action]');
  if (trigger) actions[trigger.dataset.action]?.(trigger.dataset, trigger);
});

document.addEventListener('input', ({ target }) => {
  if (target.id === 'place-search') runSearch(target.value, '#place-results', 'results', 'add-result');
  if (target.id === 'trip-search') runSearch(target.value, '#trip-results', 'tripResults', 'trip-pick');
  if (target.id === 'radar-slider') seekRadar(Number(target.value), context());
  if (target.id === 'pref-name') {
    state.prefs.name = target.value;
    savePrefs(state.prefs);
  }
  if (target.dataset.threshold) {
    const id = target.dataset.threshold;
    document.querySelector(`#threshold-${id}`).textContent =
      thresholdLabel(id, Number(target.value), state.prefs.units);
  }
});

document.addEventListener('change', ({ target }) => {
  // Only redraw behind the settings sheet. During setup, a redraw here would swap
  // out the Next button in the middle of the click that blurred this field.
  if (target.id === 'pref-name' && state.openSheet) render();
  if (target.id === 'trip-date') state.trip.date = target.value;
  if (target.id === 'trip-hour') state.trip.hour = Number(target.value);
  if (target.dataset.threshold) {
    state.prefs.thresholds[target.dataset.threshold] = Number(target.value);
    savePrefs(state.prefs);
    render();
  }
});

sheet.addEventListener('close', () => {
  if (sheet.open) return; // This event fires late; another sheet may have opened since.
  state.openSheet = null;
  sheet.innerHTML = '';
});

addEventListener('hashchange', route);

document.addEventListener('visibilitychange', () => {
  const stale = state.wx && Date.now() - state.wx.fetchedAt > REFRESH_AFTER_MS;
  if (document.visibilityState === 'visible' && stale && !FORCE_DEMO) loadWeather();
});

state.tab = TABS.find((tab) => `#/${tab.id}` === location.hash)?.id ?? 'home';
render();
loadWeather();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Offline support is optional; the app works without it.
  });
}

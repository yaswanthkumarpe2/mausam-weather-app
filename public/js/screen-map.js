// Member 2: the interactive map. Leaflet loads only when this tab opens. Layers are
// animated rain radar (RainViewer), city temperature, air quality and wind (Open-Meteo),
// and community reports. Tapping anywhere gives a quick forecast for that point.
import { fetchCities, fetchReports } from './api.js';
import { AQI_COLOR } from './cards.js';
import { aqiBand, esc, fmtTemp, fmtWind } from './format.js';
import { icon } from './icons.js';
import { screenHead } from './screen-parts.js';
import { describeCode } from './weather-codes.js';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const RADAR_INDEX = 'https://api.rainviewer.com/public/weather-maps.json';
const FRAME_MS = 700;
const CITY_CACHE_MS = 15 * 60 * 1000;

const LAYERS = ['rain', 'temp', 'air', 'wind', 'reports'];

const CITIES = [
  ['Delhi', 28.61, 77.21], ['Mumbai', 19.08, 72.88], ['Bengaluru', 12.97, 77.59], ['Hyderabad', 17.39, 78.49],
  ['Chennai', 13.08, 80.27], ['Kolkata', 22.57, 88.36], ['Ahmedabad', 23.03, 72.59], ['Pune', 18.52, 73.86],
  ['Jaipur', 26.91, 75.79], ['Lucknow', 26.85, 80.95], ['Bhopal', 23.26, 77.41], ['Nagpur', 21.15, 79.09],
  ['Patna', 25.59, 85.14], ['Bhubaneswar', 20.3, 85.82], ['Guwahati', 26.14, 91.74], ['Chandigarh', 30.73, 76.78],
  ['Srinagar', 34.08, 74.8], ['Shimla', 31.1, 77.17], ['Dehradun', 30.32, 78.03], ['Ranchi', 23.34, 85.31],
  ['Raipur', 21.25, 81.63], ['Visakhapatnam', 17.69, 83.22], ['Vijayawada', 16.51, 80.65], ['Kochi', 9.93, 76.27],
  ['Thiruvananthapuram', 8.52, 76.94], ['Coimbatore', 11.02, 76.96], ['Mangaluru', 12.91, 74.86], ['Goa', 15.5, 73.83],
  ['Jodhpur', 26.24, 73.02], ['Imphal', 24.82, 93.94], ['Port Blair', 11.62, 92.73], ['Leh', 34.16, 77.58],
].map(([name, lat, lon]) => ({ name, lat, lon }));

const view = {
  layer: 'rain',
  center: null,
  zoom: 5,
  cities: null,
  citiesAt: 0,
};

let L = null;
let map = null;
let overlay = null;
let radarLayers = [];
let radarFrames = [];
let radarIndex = 0;
let radarTimer = 0;
let handlers = null;

function loadLeaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.append(css);
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve(globalThis.L);
    script.onerror = reject;
    document.head.append(script);
  });
}

export function renderMap(ctx, location) {
  const { t } = ctx;
  const tabs = LAYERS.map((id) => `
    <button data-action="map-layer" data-id="${id}" aria-pressed="${id === view.layer}">${esc(t(`map.${id}`))}</button>`);
  return `
    <div class="map-screen">
      ${screenHead(ctx, location, 'nav.map')}
      <div class="pills map-layers">${tabs.join('')}</div>
      <div id="map" class="map" role="application" aria-label="${esc(t('nav.map'))}">
        <p class="screen-loading">${esc(t('map.loading'))}</p>
      </div>
      <div id="map-panel" class="map-panel"></div>
    </div>`;
}

function clearOverlay() {
  clearInterval(radarTimer);
  radarTimer = 0;
  radarLayers.forEach((layer) => layer.remove());
  radarLayers = [];
  overlay?.remove();
  overlay = null;
}

function setPanel(html) {
  const panel = document.querySelector('#map-panel');
  if (panel) panel.innerHTML = html;
}

const pad = (n) => String(n).padStart(2, '0');

function showFrame(index, ctx) {
  radarIndex = index;
  radarLayers.forEach((layer, i) => layer.setOpacity(i === index ? 0.75 : 0));
  const when = new Date(radarFrames[index].time * 1000);
  const slider = document.querySelector('#radar-slider');
  const label = document.querySelector('#radar-time');
  if (slider) slider.value = index;
  if (label) label.textContent = `${pad(when.getHours())}:${pad(when.getMinutes())}`;
  return ctx;
}

function radarControls(ctx, playing) {
  const { t } = ctx;
  setPanel(`
    <button class="icon-button round" data-action="radar-toggle" aria-label="${esc(t(playing ? 'map.pause' : 'map.play'))}">${icon(playing ? 'pause' : 'play')}</button>
    <input id="radar-slider" type="range" min="0" max="${radarFrames.length - 1}" value="${radarIndex}" aria-label="${esc(t('map.rain'))}">
    <span id="radar-time" class="radar-time"></span>
    <small class="sub map-hint">${esc(t('map.past'))} · ${esc(t('map.tap'))}</small>`);
  showFrame(radarIndex, ctx);
}

export function toggleRadar(ctx) {
  if (radarTimer) {
    clearInterval(radarTimer);
    radarTimer = 0;
    radarControls(ctx, false);
    return;
  }
  radarTimer = setInterval(() => showFrame((radarIndex + 1) % radarFrames.length, ctx), FRAME_MS);
  radarControls(ctx, true);
}

export function seekRadar(index, ctx) {
  if (radarTimer) toggleRadar(ctx);
  showFrame(index, ctx);
}

async function showRadar(ctx) {
  const { t } = ctx;
  try {
    const response = await fetch(RADAR_INDEX, { signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    radarFrames = data.radar.past;
    if (view.layer !== 'rain' || !map) return;
    radarLayers = radarFrames.map((frame) => L.tileLayer(`${data.host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`, {
      opacity: 0,
      maxNativeZoom: 7,
      zIndex: 5,
      attribution: '<a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>',
    }).addTo(map));
    radarIndex = radarFrames.length - 1;
    radarTimer = setInterval(() => showFrame((radarIndex + 1) % radarFrames.length, ctx), FRAME_MS);
    radarControls(ctx, true);
  } catch {
    setPanel(`<small class="sub">${esc(t('map.radarFailed'))}</small>`);
  }
}

const tempColor = (celsius) => {
  if (celsius >= 38) return '#d7301f';
  if (celsius >= 32) return '#ef6c2f';
  if (celsius >= 26) return '#f2a93b';
  if (celsius >= 18) return '#3fae6a';
  if (celsius >= 8) return '#2f8fce';
  return '#6a5acd';
};

function bubble(html, color) {
  return L.divIcon({
    className: '',
    html: `<span class="map-bubble" style="background:${color}">${html}</span>`,
    iconSize: [46, 28],
    iconAnchor: [23, 14],
  });
}

async function cityData(ctx) {
  const saved = ctx.prefs.locations.map(({ name, lat, lon }) => ({ name, lat, lon }));
  const fresh = view.cities && Date.now() - view.citiesAt < CITY_CACHE_MS && view.cities.length >= CITIES.length + saved.length;
  if (fresh) return view.cities;
  view.cities = await fetchCities([...CITIES, ...saved]);
  view.citiesAt = Date.now();
  return view.cities;
}

async function showCities(ctx, layer) {
  const { t, units } = ctx;
  setPanel(`<small class="sub">${esc(t('map.loading'))}</small>`);
  try {
    const cities = await cityData(ctx);
    if (view.layer !== layer || !map) return;
    overlay = L.layerGroup(cities.flatMap((city) => {
      let content;
      let color;
      if (layer === 'temp') {
        content = fmtTemp(city.temp, units.temp);
        color = tempColor(city.temp);
      } else if (layer === 'air') {
        if (city.aqi == null) return [];
        content = String(city.aqi);
        color = AQI_COLOR[aqiBand(city.aqi)];
      } else {
        const arrow = `<i class="wind-arrow" style="transform:rotate(${(city.windDir + 180) % 360}deg)">↑</i>`;
        content = `${arrow}${Math.round(city.windKmh)}`;
        color = '#25527a';
      }
      const marker = L.marker([city.lat, city.lon], { icon: bubble(content, color), title: city.name });
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        handlers.pointForecast(city.lat, city.lon, city.name);
      });
      return [marker];
    })).addTo(map);
    setPanel(`<small class="sub map-hint">${esc(t('map.tap'))}</small>`);
  } catch {
    setPanel(`<small class="sub">${esc(t('map.tapFailed'))}</small>`);
  }
}

async function showReports(ctx) {
  const { t, location } = ctx;
  setPanel(`<small class="sub map-hint">${esc(t('people.note'))}</small>`);
  try {
    const reports = await fetchReports(location, 3000);
    if (view.layer !== 'reports' || !map) return;
    overlay = L.layerGroup(reports.map((report) => L.marker([report.lat, report.lon], {
      icon: bubble(esc(t(`report.${report.type}`)).slice(0, 12), '#0b6577'),
    }).bindPopup(`<strong>${esc(t(`report.${report.type}`))}</strong><br>${esc(report.place)}<br>${esc(report.note)}`))).addTo(map);
  } catch {
    setPanel(`<small class="sub">${esc(t('people.failed'))}</small>`);
  }
}

function showLayer(ctx) {
  clearOverlay();
  if (view.layer === 'rain') showRadar(ctx);
  else if (view.layer === 'reports') showReports(ctx);
  else showCities(ctx, view.layer);
}

export function setMapLayer(id, ctx) {
  view.layer = id;
  document.querySelectorAll('[data-action="map-layer"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.id === id));
  });
  if (map) showLayer(ctx);
}

export function pointPopupHtml(ctx, data, name) {
  const { t, units } = ctx;
  const condition = describeCode(data.code, data.isDay);
  return `
    <div class="map-popup">
      <strong>${esc(name ?? t('map.pin'))}</strong>
      <span class="map-popup-main">${icon(condition.icon)}<b>${fmtTemp(data.temp, units.temp)}</b></span>
      <span>${esc(t(`wx.${condition.key}`))}</span>
      <small>${esc(fmtWind(data.windKmh, units.wind))}${data.aqi != null ? ` · ${esc(t('stat.aqi'))} ${data.aqi}` : ''}</small>
      <button class="link-button" data-action="map-save" data-lat="${data.lat}" data-lon="${data.lon}" data-name="${esc(name ?? '')}">${esc(t('map.save'))}</button>
    </div>`;
}

export async function mountMap(ctx) {
  const element = document.querySelector('#map');
  const { t, location } = ctx;
  handlers = {
    async pointForecast(lat, lon, name) {
      const popup = L.popup().setLatLng([lat, lon]).setContent(esc(t('map.tapLoading'))).openOn(map);
      try {
        const [data] = await fetchCities([{ lat, lon }]);
        popup.setContent(pointPopupHtml(ctx, data, name));
      } catch {
        popup.setContent(esc(t('map.tapFailed')));
      }
    },
  };

  try {
    L = await loadLeaflet();
  } catch {
    if (element) element.innerHTML = `<p class="screen-loading">${esc(t('map.failed'))}</p>`;
    return;
  }
  if (!document.body.contains(element)) return; // The user left this tab while it loaded.

  element.innerHTML = '';
  map = L.map(element, { zoomControl: false, attributionControl: true, worldCopyJump: true });
  map.setView(view.center ?? [location.lat, location.lon], view.zoom);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  // OpenStreetMap needs no key. The dark look is a CSS filter on this layer only, so
  // the radar colours above it stay true.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12,
    className: 'base-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
  L.circleMarker([location.lat, location.lon], {
    radius: 7, color: '#fff', weight: 2, fillColor: '#2f8fce', fillOpacity: 1,
  }).addTo(map);

  map.on('click', ({ latlng }) => handlers.pointForecast(latlng.lat, latlng.lng));
  map.on('moveend', () => {
    view.center = map.getCenter();
    view.zoom = map.getZoom();
  });
  showLayer(ctx);
}

export function unmountMap() {
  clearOverlay();
  map?.remove();
  map = null;
}

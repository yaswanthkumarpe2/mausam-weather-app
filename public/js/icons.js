// Hand-drawn inline SVG icons, so the app needs no icon font or image requests.

const CLOUD = 'M9.5 24a6 6 0 0 1-.7-11.96A8 8 0 0 1 24.3 13.6 5.25 5.25 0 0 1 23.5 24z';
const raised = `<path transform="translate(0 -4.5)" d="${CLOUD}"/>`;
const sunRays = [0, 45, 90, 135, 180, 225, 270, 315]
  .map((angle) => `<path transform="rotate(${angle} 16 16)" d="M16 3.5v3"/>`)
  .join('');

const PATHS = {
  sun: `<g class="i-sun"><circle cx="16" cy="16" r="6"/>${sunRays}</g>`,
  moon: '<path class="i-moon" d="M25.5 19.6A10.5 10.5 0 1 1 12.4 6.5a8.4 8.4 0 0 0 13.1 13.1z"/>',
  cloud: `<path d="${CLOUD}"/>`,
  partly: `<g class="i-sun"><circle cx="11" cy="11" r="4.5"/><path d="M11 2.5v2M2.5 11h2M5 5l1.4 1.4M17 5l-1.4 1.4"/></g><path transform="translate(5 6) scale(.82)" d="${CLOUD}"/>`,
  partlyNight: `<path class="i-moon" d="M15 9.6A6.5 6.5 0 1 1 7.4 3a5.2 5.2 0 0 0 7.6 6.6z"/><path transform="translate(5 6) scale(.82)" d="${CLOUD}"/>`,
  fog: `${raised}<path class="i-rain" d="M7 24h18M10 28h12"/>`,
  drizzle: `${raised}<path class="i-rain" d="M11 24v.1M16 26v.1M21 24v.1"/>`,
  rain: `${raised}<path class="i-rain" d="M11.5 23l-2 5M17 23l-2 5M22.5 23l-2 5"/>`,
  snow: `${raised}<path class="i-rain" d="M11 25v.1M16 27v.1M21 25v.1M13.5 29v.1M18.5 29v.1"/>`,
  storm: `${raised}<path class="i-sun" d="M17.5 20l-4 5.5h4l-2.5 4.5"/>`,

  home: '<path d="M5 15L16 5l11 10M8 13v13h6v-7h4v7h6V13"/>',
  map: '<path d="M4 8l8-3 8 3 8-3v19l-8 3-8-3-8 3zM12 5v19M20 8v19"/>',
  people: '<circle cx="12" cy="11" r="4.5"/><path d="M4 26c0-5 3.5-8 8-8s8 3 8 8M21 7.5a4.5 4.5 0 0 1 0 7M23.5 18.5c2.800 1.200 4.500 3.800 4.500 7.500"/>',
  calendar: '<rect x="5" y="7" width="22" height="20" rx="3"/><path d="M5 13h22M11 4v5M21 4v5M11 19h3M18 19h3M11 23h3"/>',
  bell: '<path d="M8 22V14a8 8 0 0 1 16 0v8l2.500 3h-21zM13 28a3 3 0 0 0 6 0"/>',
  speaker: '<path d="M5 12v8h5l7 6V6l-7 6zM21 11.500a6 6 0 0 1 0 9M24 8a11 11 0 0 1 0 16"/>',
  stop: '<rect x="8" y="8" width="16" height="16" rx="3"/>',
  share: '<path d="M16 20V5M10 10l6-6 6 6M7 16v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9"/>',
  megaphone: '<path d="M5 13v6h5l13 6V7L10 13zM10 19l2 7h4l-2-5M26 13v6"/>',
  play: '<path d="M10 6l16 10-16 10z"/>',
  pause: '<path d="M11 6v20M21 6v20"/>',
  thumb: '<path d="M10 14l5-9c2 0 3 1.500 3 3.500V12h6.500a2.500 2.500 0 0 1 2.400 3.100l-2 8.500a3 3 0 0 1-2.900 2.400H10zM10 14H5v12h5"/>',
  plus: '<path d="M16 6v20M6 16h20"/>',
  arrow: '<path d="M6 16h19M18 9l7 7-7 7"/>',
  flame: '<path d="M16 3c1 5 8 8 8 16a8 8 0 0 1-16 0c0-3 1.500-5 3-6 0 3 1 4 2.500 4C13 12 13 7 16 3z"/>',
  heart: '<path d="M16 27S4 20 4 12a6.500 6.500 0 0 1 12-3.500A6.500 6.500 0 0 1 28 12c0 8-12 15-12 15z"/>',
  child: '<circle cx="16" cy="8" r="4"/><path d="M16 12v9M9 16l7-2 7 2M11 28l5-7 5 7"/>',
  walk: '<circle cx="17" cy="6" r="2.500"/><path d="M15 11l-4 5 1 6M15 11l4 3 4 1M15 11l1 8 4 8M15 19l-4 8"/>',
  cycle: '<circle cx="8" cy="21" r="5.500"/><circle cx="24" cy="21" r="5.500"/><path d="M8 21l5-10h7l4 10M13 11l5 10H8M18 6h3l-1 5"/>',
  bat: '<path d="M26 5l2 2-13 13-3 1-1 1-2-2 1-1 1-3zM6 26l2-2"/><circle cx="24" cy="24" r="2.500"/>',
  basket: '<path d="M5 13h22l-3 14H8zM10 13l5-8M22 13l-5-8M12 18v5M16 18v5M20 18v5"/>',
  shirt: '<path d="M11 5l5 3 5-3 7 5-3 5-3-1v13H10V14l-3 1-3-5z"/>',
  kite: '<path d="M16 3l9 10-9 13-9-13zM7 13h18M16 3v23M16 26c-2 2 1 3-1 5"/>',
  star: '<path d="M16 4l3.700 7.800 8.300 1.100-6.100 5.800 1.600 8.300-7.500-4.100-7.500 4.100 1.600-8.300L4 12.900l8.300-1.100z"/>',
  party: '<path d="M6 27l6-17 11 11zM17 8c0-2 1-3 3-3M23 12c2-1 3-1 4 0M20 4v.1M27 8v.1"/>',
  mountain: '<path d="M3 26L12 9l5 9 3-5 9 13zM12 9l-2 7 3 2 2-2"/>',
  jacket: '<path d="M11 5h10l6 5v16h-5V15v12H10V15v11H5V10zM16 5v22"/>',
  umbrella: '<path d="M16 5a12 12 0 0 1 12 12H4A12 12 0 0 1 16 5zM16 3v2M16 17v9a3 3 0 0 1-6 0"/>',
  glasses: '<circle cx="9" cy="18" r="5"/><circle cx="23" cy="18" r="5"/><path d="M14 17c1.200-1 2.800-1 4 0M4 18V12l3-4M28 18V12l-3-4"/>',
  hat: '<path d="M3 22c6 3 20 3 26 0M8 22c0-8 2-13 8-13s8 5 8 13"/>',
  mask: '<path d="M6 12c6 3 14 3 20 0v8c-3 5-7 6-10 6s-7-1-10-6zM6 14H3c0 4 1 6 4 7M26 14h3c0 4-1 6-4 7M11 17h10M12 21h8"/>',

  pin: '<path d="M16 28s9-8 9-15a9 9 0 1 0-18 0c0 7 9 15 9 15z"/><circle cx="16" cy="13" r="3"/>',
  chevron: '<path d="M9 13l7 7 7-7"/>',
  gear: '<path d="M6 10h12M24 10h2M6 22h2M14 22h12"/><circle cx="21" cy="10" r="3"/><circle cx="11" cy="22" r="3"/>',
  search: '<circle cx="14" cy="14" r="8"/><path d="M20 20l6 6"/>',
  locate: '<circle cx="16" cy="16" r="8"/><circle cx="16" cy="16" r="2.5"/><path d="M16 3v5M16 24v5M3 16h5M24 16h5"/>',
  close: '<path d="M8 8l16 16M24 8L8 24"/>',
  up: '<path d="M16 26V6M8 14l8-8 8 8"/>',
  down: '<path d="M16 6v20M8 18l8 8 8-8"/>',
  check: '<path d="M6 17l7 7L26 9"/>',
  alert: '<path d="M16 5L3 27h26zM16 13v7M16 24v.1"/>',
  drop: '<path class="i-rain" d="M16 4s9 10 9 16a9 9 0 0 1-18 0c0-6 9-16 9-16z"/>',
  wind: '<path d="M4 12h15a4 4 0 1 0-4-4M4 18h20a4 4 0 1 1-4 4M4 24h9"/>',
  leaf: '<path d="M6 26C6 13 14 6 27 5c0 13-6 21-17 19M6 26c3-6 7-10 13-13"/>',
  bus: '<rect x="6" y="5" width="20" height="19" rx="3"/><path d="M6 15h20M10 24v3M22 24v3M11 20v.1M21 20v.1"/>',
  run: '<circle cx="20" cy="6" r="2.5"/><path d="M8 15l5-5 6 2-3 7 5 3v7M16 19l-4 8H6M19 12l3 4h5"/>',
  lungs: '<path d="M16 5v10M16 13l-4 3M16 13l4 3M10 10c-3 1-6 8-6 13 0 3 2 4 4 3l4-2v-9c0-3-1-5-2-5zM22 10c3 1 6 8 6 13 0 3-2 4-4 3l-4-2v-9c0-3 1-5 2-5z"/>',
  bag: '<rect x="6" y="10" width="20" height="16" rx="3"/><path d="M12 10V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M12 15v6M20 15v6"/>',
  heat: '<path d="M13 18V7a3 3 0 0 1 6 0v11a6 6 0 1 1-6 0zM16 13v9"/>',
};

export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? PATHS.cloud}</svg>`;
}

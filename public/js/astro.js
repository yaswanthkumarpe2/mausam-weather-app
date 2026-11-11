// Member 1: moon phase and daylight, worked out from the date with no data source.
import { minutesOf } from './format.js';

const SYNODIC_DAYS = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const NAMES = [
  'new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous',
  'full', 'waningGibbous', 'lastQuarter', 'waningCrescent',
];

export function moonPhase(date) {
  const days = (Date.parse(`${date}T12:00:00Z`) - KNOWN_NEW_MOON) / 864e5;
  const age = ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const fraction = age / SYNODIC_DAYS;
  return {
    fraction,
    illumination: Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100),
    name: NAMES.at(Math.round(fraction * 8) % 8),
  };
}

export function daylightMinutes(sunrise, sunset) {
  return minutesOf(sunset) - minutesOf(sunrise);
}

// The hour before sunset, in the same "YYYY-MM-DDTHH:MM" form as the forecast.
export function goldenHourStart(sunset) {
  const minutes = minutesOf(sunset) - 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${sunset.slice(0, 11)}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

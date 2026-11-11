// WMO weather interpretation codes -> condition key, icon and hero sky.

const GROUPS = [
  { codes: [0], key: 'clear', icon: 'sun', sky: 'clear' },
  { codes: [1], key: 'mostlyClear', icon: 'sun', sky: 'clear' },
  { codes: [2], key: 'partlyCloudy', icon: 'partly', sky: 'clear' },
  { codes: [3], key: 'overcast', icon: 'cloud', sky: 'cloudy' },
  { codes: [45, 48], key: 'fog', icon: 'fog', sky: 'fog' },
  { codes: [51, 53, 55, 56, 57], key: 'drizzle', icon: 'drizzle', sky: 'rain' },
  { codes: [61, 63, 66, 80, 81], key: 'rain', icon: 'rain', sky: 'rain' },
  { codes: [65, 67, 82], key: 'heavyRain', icon: 'rain', sky: 'rain' },
  { codes: [71, 73, 75, 77, 85, 86], key: 'snow', icon: 'snow', sky: 'cloudy' },
  { codes: [95, 96, 99], key: 'thunderstorm', icon: 'storm', sky: 'storm' },
];

const BY_CODE = new Map(GROUPS.flatMap((g) => g.codes.map((code) => [code, g])));
const UNKNOWN = { key: 'unknown', icon: 'cloud', sky: 'cloudy' };
const NIGHT_ICON = { sun: 'moon', partly: 'partlyNight' };

export function describeCode(code, isDay = true) {
  const { key, icon, sky } = BY_CODE.get(code) ?? UNKNOWN;
  return {
    key,
    icon: isDay ? icon : (NIGHT_ICON[icon] ?? icon),
    sky: `${sky}-${isDay ? 'day' : 'night'}`,
  };
}

export const isThunder = (code) => code >= 95;

// The sky to draw for a forecast. Clear skies near sunrise or sunset get a warm glow.
export function skyFor(wx) {
  const { code, isDay, time } = wx.current;
  const { sky } = describeCode(code, isDay);
  if (!sky.startsWith('clear') || !wx.daily[0]) return sky;
  const minutes = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  const now = minutes(time);
  const nearSun = [wx.daily[0].sunrise, wx.daily[0].sunset].some((sun) => Math.abs(now - minutes(sun)) <= 40);
  return nearSun ? 'golden' : sky;
}

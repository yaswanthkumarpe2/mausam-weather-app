// Member 4: daily streak, badges and the alert history. Plain data in, data out.

export const BADGES = [
  { id: 'firstVisit', icon: 'star', earned: (s) => s.visits >= 1 },
  { id: 'streak3', icon: 'flame', earned: (s) => s.best >= 3 },
  { id: 'streak7', icon: 'flame', earned: (s) => s.best >= 7 },
  { id: 'reporter', icon: 'people', earned: (s) => s.reports >= 1 },
  { id: 'reporter5', icon: 'people', earned: (s) => s.reports >= 5 },
  { id: 'explorer', icon: 'map', earned: (s) => s.places >= 3 },
  { id: 'planner', icon: 'calendar', earned: (s) => s.trips >= 1 },
  { id: 'listener', icon: 'speaker', earned: (s) => s.briefings >= 1 },
];

export const EMPTY_STATS = { visits: 0, streak: 0, best: 0, lastDay: null, reports: 0, places: 0, trips: 0, briefings: 0 };

const dayBefore = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

export function checkIn(stats, today) {
  if (stats.lastDay === today) return stats;
  const streak = stats.lastDay === dayBefore(today) ? stats.streak + 1 : 1;
  return { ...stats, visits: stats.visits + 1, streak, best: Math.max(stats.best, streak), lastDay: today };
}

export const earnedBadges = (stats) => BADGES.filter((badge) => badge.earned(stats)).map((badge) => badge.id);

const MAX_LOG = 40;

// Adds today's alerts to the history, once per alert type, place and day. Returns
// the new log and the entries that are new, so the app can notify about those only.
export function logAlerts(log, alerts, placeName, date) {
  const fresh = alerts
    .map((alert) => ({ key: `${date}|${placeName}|${alert.id}`, id: alert.id, severity: alert.severity, icon: alert.icon, params: alert.params, place: placeName, date }))
    .filter((entry) => !log.some((old) => old.key === entry.key));
  return { log: [...fresh, ...log].slice(0, MAX_LOG), fresh };
}

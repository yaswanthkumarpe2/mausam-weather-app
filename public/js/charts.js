// Member 2: small SVG chart builders. They return strings so they can be tested
// without a browser, and they take colours from the page's CSS variables.

const f1 = (n) => n.toFixed(1);

// A smooth line through points (Catmull-Rom spline as Bézier curves).
export function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M${f1(points[0].x)} ${f1(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${f1(c1x)} ${f1(c1y)} ${f1(c2x)} ${f1(c2y)} ${f1(p2.x)} ${f1(p2.y)}`;
  }
  return d;
}

// One or more lines on shared axes. series: [{ values, color, fill?, dashed? }].
export function lineChart({ series, labels = [], width = 340, height = 150, id, min, max, ariaLabel = '', format = (v) => String(Math.round(v)) }) {
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  if (!all.length) return '';
  const low = min ?? Math.min(...all);
  const high = max ?? Math.max(...all);
  const span = Math.max(high - low, 1);
  const pad = { left: 34, right: 8, top: 10, bottom: 22 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const longest = Math.max(...series.map((s) => s.values.length));
  const x = (i) => pad.left + (longest < 2 ? 0 : (i / (longest - 1)) * plotW);
  const y = (v) => pad.top + plotH - ((v - low) / span) * plotH;

  const grid = [low, low + span / 2, high].map((v) => `
    <line class="c-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${f1(y(v))}" y2="${f1(y(v))}"/>
    <text class="c-axis" x="${pad.left - 6}" y="${f1(y(v) + 4)}" text-anchor="end">${format(v)}</text>`).join('');

  const lines = series.map((s, index) => {
    const points = s.values.flatMap((v, i) => (v == null ? [] : [{ x: x(i), y: y(v) }]));
    const path = smoothPath(points);
    const fill = s.fill ? `<path d="${path}L${f1(points.at(-1).x)} ${pad.top + plotH}L${f1(points[0].x)} ${pad.top + plotH}Z" fill="url(#${id}-${index})"/>` : '';
    const gradient = s.fill ? `<linearGradient id="${id}-${index}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".45"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>` : '';
    return `<defs>${gradient}</defs>${fill}<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="5 5"' : ''}/>`;
  }).join('');

  const ticks = labels.map((label) => label && `
    <text class="c-axis" x="${f1(x(label.index))}" y="${height - 5}" text-anchor="middle">${label.text}</text>`).join('');

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">${grid}${lines}${ticks}</svg>`;
}

// Paired bars per day. groups: [{ label, a, b }], where a and b are numbers.
export function pairedBars({ groups, width = 340, height = 150, colorA, colorB, ariaLabel = '' }) {
  const top = Math.max(1, ...groups.flatMap((g) => [g.a, g.b]));
  const pad = { left: 6, right: 6, top: 14, bottom: 22 };
  const plotH = height - pad.top - pad.bottom;
  const slot = (width - pad.left - pad.right) / groups.length;
  const barW = Math.min(14, slot / 2.6);

  const bars = groups.map((group, i) => {
    const center = pad.left + slot * i + slot / 2;
    const bar = (value, x, color) => {
      const h = (value / top) * plotH;
      return `<rect x="${f1(x)}" y="${f1(pad.top + plotH - h)}" width="${f1(barW)}" height="${f1(Math.max(h, 1.5))}" rx="3" fill="${color}"/>`;
    };
    return `${bar(group.a, center - barW - 1, colorA)}${bar(group.b, center + 1, colorB)}
      <text class="c-axis" x="${f1(center)}" y="${height - 5}" text-anchor="middle">${group.label}</text>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${ariaLabel}">
    <line class="c-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${pad.top + plotH}" y2="${pad.top + plotH}"/>${bars}</svg>`;
}

// A circular score from 0 to 100, or any value against `max`.
export function ring({ value, max = 100, size = 64, stroke = 7, color = 'var(--accent)', label = '' }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const done = Math.min(Math.max(value / max, 0), 1) * circumference;
  const c = size / 2;
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${f1(radius)}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
    <circle cx="${c}" cy="${c}" r="${f1(radius)}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${f1(done)} ${f1(circumference)}" transform="rotate(-90 ${c} ${c})"/>
    <text x="${c}" y="${c + size * 0.09}" text-anchor="middle" font-size="${f1(size * 0.28)}" font-weight="600" fill="currentColor">${label}</text>
  </svg>`;
}

// The lit part of the moon. `fraction` runs from 0 (new) through 0.5 (full) to 1.
export function moonSvg(fraction, size = 72) {
  const r = 30;
  const c = 36;
  const waxing = fraction < 0.5;
  const lit = Math.cos(2 * Math.PI * fraction); // 1 at new moon, -1 at full moon.
  const rx = f1(Math.abs(lit) * r);
  const outer = waxing ? 1 : 0;
  const inner = (lit > 0) === waxing ? 0 : 1;
  const path = `M${c} ${c - r}A${r} ${r} 0 0 ${outer} ${c} ${c + r}A${rx} ${r} 0 0 ${inner} ${c} ${c - r}Z`;
  return `<svg class="moon" viewBox="0 0 72 72" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${r}" fill="var(--track)"/>
    <path d="${path}" fill="#f4e7ae"/>
  </svg>`;
}

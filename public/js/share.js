// Member 1: draws today's weather as a square image, then shares or downloads it.

const SKY_COLORS = {
  'clear-day': ['#0a4f8f', '#2f8fd6'],
  'clear-night': ['#070f2b', '#1d2f66'],
  golden: ['#231f5c', '#c8654f'],
  'cloudy-day': ['#2e3e52', '#5f7388'],
  'cloudy-night': ['#0e1522', '#2b3950'],
  'rain-day': ['#16283b', '#35617a'],
  'rain-night': ['#0a1420', '#1f3a50'],
  'storm-day': ['#14152b', '#463d6b'],
  'storm-night': ['#0a0b18', '#2f2a4e'],
  'fog-day': ['#3d4955', '#6b7681'],
  'fog-night': ['#161c24', '#38434f'],
};

function wrapLines(context, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(data) {
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  const font = (px, weight = 400) => `${weight} ${px}px Mukta, "Noto Sans Devanagari", system-ui, sans-serif`;

  const [top, bottom] = SKY_COLORS[data.sky] ?? SKY_COLORS['cloudy-day'];
  const sky = c.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bottom);
  c.fillStyle = sky;
  c.fillRect(0, 0, size, size);

  c.fillStyle = 'rgba(255,255,255,.08)';
  c.beginPath();
  c.arc(900, 170, 300, 0, Math.PI * 2);
  c.fill();

  c.fillStyle = '#fff';
  c.font = font(60, 600);
  c.fillText(data.place, 80, 150);
  c.font = font(38);
  c.fillStyle = 'rgba(255,255,255,.82)';
  c.fillText(data.date, 80, 210);

  c.fillStyle = '#fff';
  c.font = font(300, 300);
  c.fillText(data.temp, 66, 560);
  c.font = font(66, 500);
  c.fillText(data.condition, 80, 670);
  c.font = font(42);
  c.fillStyle = 'rgba(255,255,255,.88)';
  c.fillText(data.range, 80, 740);

  c.font = font(44, 500);
  c.fillStyle = '#fff';
  wrapLines(c, data.summary, size - 160).slice(0, 2).forEach((line, i) => c.fillText(line, 80, 850 + i * 58));

  c.font = font(34, 600);
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.fillText('Mausam', 80, 1010);
  return canvas;
}

// Returns 'shared', 'saved' or 'cancelled'.
export async function shareCard(data, title) {
  const canvas = drawCard(data);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'mausam-weather.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelled';
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}

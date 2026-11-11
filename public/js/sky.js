// Member 1: the animated sky behind the app, drawn on one full-screen canvas. Rain,
// stars, clouds, fog and lightning follow the forecast. It stops when the page is
// hidden, and draws a single still frame if the user prefers reduced motion.

const canvas = document.querySelector('#sky');
const context = canvas?.getContext('2d');
const calm = matchMedia('(prefers-reduced-motion: reduce)');

let scene = '';
let particles = [];
let clouds = [];
let flash = 0;
let frame = 0;
let width = 0;
let height = 0;

const random = (low, high) => low + Math.random() * (high - low);

function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  width = innerWidth;
  height = innerHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function buildScene(name) {
  const [kind, time] = name.split('-');
  const dense = width > 900 ? 1.6 : 1;

  particles = [];
  if (kind === 'rain' || kind === 'storm') {
    const count = (kind === 'storm' ? 150 : 100) * dense;
    particles = Array.from({ length: count }, () => ({
      x: random(0, width), y: random(0, height), length: random(10, 24), speed: random(9, 17),
    }));
  }
  if (kind === 'clear' && time === 'night') {
    particles = Array.from({ length: 90 * dense }, () => ({
      x: random(0, width), y: random(0, height * 0.7), size: random(0.5, 1.8), phase: random(0, 6.28),
    }));
  }

  const cloudCount = { clear: 2, golden: 3, cloudy: 7, rain: 8, storm: 9, fog: 10 }[kind] ?? 3;
  clouds = Array.from({ length: cloudCount }, (_, i) => ({
    x: random(-200, width),
    y: random(-20, height * (kind === 'fog' ? 0.9 : 0.42)),
    size: random(90, 220),
    speed: random(0.06, 0.22),
    alpha: kind === 'clear' ? 0.06 : kind === 'fog' ? 0.1 : 0.09,
    seed: i,
  }));
}

function drawCloud(cloud) {
  const { x, y, size, alpha } = cloud;
  const gradient = context.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(x, y, size * 1.6, size * 0.7, 0, 0, Math.PI * 2);
  context.fill();
}

function draw() {
  frame += 1;
  context.clearRect(0, 0, width, height);
  const kind = scene.split('-')[0];

  for (const cloud of clouds) {
    drawCloud(cloud);
    cloud.x += cloud.speed;
    if (cloud.x - cloud.size * 1.6 > width) cloud.x = -cloud.size * 1.6;
  }

  if (kind === 'rain' || kind === 'storm') {
    context.strokeStyle = 'rgba(190,225,255,.34)';
    context.lineWidth = 1.2;
    context.beginPath();
    for (const drop of particles) {
      context.moveTo(drop.x, drop.y);
      context.lineTo(drop.x - drop.length * 0.22, drop.y + drop.length);
      drop.y += drop.speed;
      drop.x -= drop.speed * 0.22;
      if (drop.y > height) {
        drop.y = -drop.length;
        drop.x = random(0, width + 80);
      }
    }
    context.stroke();
  } else {
    for (const star of particles) {
      const twinkle = 0.45 + 0.45 * Math.sin(star.phase + frame * 0.02);
      context.fillStyle = `rgba(255,255,255,${twinkle})`;
      context.beginPath();
      context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (kind === 'storm') {
    if (flash <= 0 && Math.random() < 0.004) flash = 1;
    if (flash > 0) {
      context.fillStyle = `rgba(225,232,255,${flash * 0.28})`;
      context.fillRect(0, 0, width, height);
      flash -= 0.07;
    }
  }
}

let running = false;

function loop() {
  if (!running) return;
  draw();
  requestAnimationFrame(loop);
}

function start() {
  if (calm.matches) {
    draw();
    return;
  }
  if (running) return;
  running = true;
  requestAnimationFrame(loop);
}

const stop = () => {
  running = false;
};

export function setSky(name) {
  document.documentElement.dataset.sky = name;
  if (!context || name === scene) return;
  scene = name;
  resize();
  buildScene(name);
  start();
}

if (context) {
  addEventListener('resize', () => {
    resize();
    buildScene(scene);
    if (calm.matches) draw();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });
}

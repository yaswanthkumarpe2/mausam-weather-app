// The project server: static files plus the community reports API. No dependencies.
// Usage: npm start               -> http://localhost:4173
//        HOST=0.0.0.0 npm start  -> reachable from phones on the same network
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activeReports, addReport, confirmReport, createRateLimiter, createReport, reportsNear,
} from './server/reports.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, 'public');
const DATA_FILE = process.env.REPORTS_FILE || join(HERE, 'data', 'reports.json');
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 2048;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

let reports = [];
const allowPost = createRateLimiter();

async function loadReports() {
  try {
    reports = activeReports(JSON.parse(await readFile(DATA_FILE, 'utf8')));
  } catch {
    reports = []; // No file yet, or an unreadable one: start empty.
  }
}

// Write to a temporary file first, so a crash can't leave half a file behind.
async function saveReports() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  const temporary = `${DATA_FILE}.tmp`;
  await writeFile(temporary, JSON.stringify(reports));
  await rename(temporary, DATA_FILE);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  // Behind a hosting proxy (TRUST_PROXY=1, e.g. on Render) every request comes from the proxy,
  // so the visitor's address is the first entry of X-Forwarded-For.
  const forwarded = process.env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  const address = forwarded || req.socket.remoteAddress || 'unknown';

  if (req.method === 'GET' && url.pathname === '/api/reports') {
    const { searchParams } = url;
    const lat = Number(searchParams.get('lat'));
    const lon = Number(searchParams.get('lon'));
    const radiusKm = Math.min(Number(searchParams.get('radius')) || 100, 3000);
    if (!searchParams.get('lat') || !searchParams.get('lon') || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      sendJson(res, 400, { error: 'lat and lon are required' });
      return;
    }
    sendJson(res, 200, { reports: reportsNear(reports, { lat, lon, radiusKm }) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/reports') {
    if (!allowPost(address)) {
      sendJson(res, 429, { error: 'Too many reports. Please wait a minute.' });
      return;
    }
    let input;
    try {
      input = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'Invalid request' });
      return;
    }
    const { report, error } = createReport(input, { id: randomUUID() });
    if (error) {
      sendJson(res, 400, { error });
      return;
    }
    reports = addReport(reports, report);
    await saveReports();
    sendJson(res, 201, { report });
    return;
  }

  const confirm = url.pathname.match(/^\/api\/reports\/([\w-]+)\/confirm$/);
  if (req.method === 'POST' && confirm) {
    if (!allowPost(address)) {
      sendJson(res, 429, { error: 'Too many requests. Please wait a minute.' });
      return;
    }
    const result = confirmReport(reports, confirm[1]);
    if (!result.report) {
      sendJson(res, 404, { error: 'Report not found' });
      return;
    }
    reports = result.reports;
    await saveReports();
    sendJson(res, 200, { report: result.report });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

async function handleStatic(res, url) {
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
  const file = join(ROOT, relative || 'index.html');
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

await loadReports();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else await handleStatic(res, url);
  } catch {
    if (!res.headersSent) sendJson(res, 500, { error: 'Server error' });
    else res.end();
  }
}).listen(PORT, HOST, () => {
  console.log(`Mausam running at http://localhost:${PORT}`);
});

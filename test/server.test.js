import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import {
  REPORT_LIFETIME_MS, activeReports, addReport, confirmReport, createRateLimiter, createReport, reportsNear,
} from '../server/reports.js';

const GUNTUR = { lat: 16.3, lon: 80.46 };

describe('reports logic', () => {
  it('accepts a valid report and rounds its location', () => {
    const { report } = createReport({ type: 'rain', note: '  heavy   drops ', lat: 16.30123, lon: 80.45999 }, { now: 5, id: 'a' });
    assert.equal(report.note, 'heavy drops');
    assert.equal(report.lat, 16.3);
    assert.equal(report.lon, 80.46);
    assert.equal(report.confirms, 0);
  });

  it('rejects unknown types and bad locations', () => {
    assert.ok(createReport({ type: 'aliens', ...GUNTUR }).error);
    assert.ok(createReport({ type: 'rain', lat: 'x', lon: 1 }).error);
    assert.ok(createReport({ type: 'rain', lat: 95, lon: 1 }).error);
    assert.ok(createReport(null).error);
  });

  it('limits text length', () => {
    const { report } = createReport({ type: 'fog', note: 'x'.repeat(500), name: 'y'.repeat(100), ...GUNTUR });
    assert.equal(report.note.length, 140);
    assert.equal(report.name.length, 24);
  });

  it('expires old reports', () => {
    const now = REPORT_LIFETIME_MS * 2;
    const reports = [{ id: 'old', at: 0 }, { id: 'new', at: now - 1000 }];
    assert.deepEqual(activeReports(reports, now).map((r) => r.id), ['new']);
  });

  it('finds reports nearby, newest first, with distance', () => {
    const reports = [
      { id: 'near-old', at: 10, ...GUNTUR },
      { id: 'near-new', at: 20, lat: 16.5, lon: 80.6 },
      { id: 'far', at: 30, lat: 28.6, lon: 77.2 },
    ];
    const found = reportsNear(reports, { ...GUNTUR, radiusKm: 100, now: 100 });
    assert.deepEqual(found.map((r) => r.id), ['near-new', 'near-old']);
    assert.ok(found[0].km > 20 && found[0].km < 35);
  });

  it('keeps the newest report first and confirms by id', () => {
    const list = addReport([{ id: 'a', at: 100, confirms: 0 }], { id: 'b', at: 200, confirms: 0 }, 300);
    assert.deepEqual(list.map((r) => r.id), ['b', 'a']);
    assert.equal(confirmReport(list, 'a').report.confirms, 1);
    assert.equal(confirmReport(list, 'zzz').report, null);
  });

  it('limits how fast one address can post', () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    assert.equal(allow('x', 0), true);
    assert.equal(allow('x', 1), true);
    assert.equal(allow('x', 2), false);
    assert.equal(allow('y', 2), true);
    assert.equal(allow('x', 2000), true);
  });
});

describe('server API', () => {
  const port = 4300 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const folder = mkdtempSync(join(tmpdir(), 'mausam-'));
  const file = join(folder, 'reports.json');
  let server;

  const post = (path, body) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  before(async () => {
    server = spawn(process.execPath, ['server.js'], {
      env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', REPORTS_FILE: file },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    await new Promise((resolve) => server.stdout.once('data', resolve));
  });

  after(() => {
    server.kill();
    rmSync(folder, { recursive: true, force: true });
  });

  it('serves the app and blocks paths outside it', async () => {
    assert.equal((await fetch(base)).status, 200);
    const escape = await fetch(`${base}/..%2f..%2fpackage.json`);
    assert.notEqual(escape.status, 200);
  });

  it('stores a report, returns it nearby and saves it to disk', async () => {
    const created = await post('/api/reports', { type: 'rain', note: 'Started just now', name: 'Test', place: 'Guntur', ...GUNTUR });
    assert.equal(created.status, 201);
    const { report } = await created.json();

    const near = await (await fetch(`${base}/api/reports?lat=16.3&lon=80.46`)).json();
    assert.equal(near.reports[0].id, report.id);

    const far = await (await fetch(`${base}/api/reports?lat=28.6&lon=77.2`)).json();
    assert.equal(far.reports.length, 0);

    assert.equal(JSON.parse(readFileSync(file, 'utf8'))[0].note, 'Started just now');

    const confirmed = await post(`/api/reports/${report.id}/confirm`, {});
    assert.equal((await confirmed.json()).report.confirms, 1);
  });

  it('rejects bad requests', async () => {
    assert.equal((await post('/api/reports', '{not json')).status, 400);
    assert.equal((await post('/api/reports', { type: 'aliens', ...GUNTUR })).status, 400);
    assert.equal((await fetch(`${base}/api/reports`)).status, 400);
    assert.equal((await post('/api/reports/nope/confirm', {})).status, 404);
    assert.equal((await fetch(`${base}/api/unknown`)).status, 404);
  });

  it('limits rapid posting', async () => {
    const statuses = [];
    for (let i = 0; i < 8; i++) {
      statuses.push((await post('/api/reports', { type: 'fog', ...GUNTUR })).status);
    }
    assert.ok(statuses.includes(429));
  });
});

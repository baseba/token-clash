import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createJevProxy } from '../server/jev-proxy.js';

const KEY = 'proxy-test-key';
const seen = [];
let upstreamStatus = 200;
const upstream = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    seen.push({ method: req.method, url: req.url, headers: req.headers, body: raw });
    res.writeHead(upstreamStatus, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ answers: { action: { choice: 'move_0' } } }));
  });
});
const quiet = { warn: () => {} };
let proxy;
let base;

before(async () => {
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r));
  proxy = createJevProxy({ apiKey: KEY, upstream: `http://127.0.0.1:${upstream.address().port}/v1/systemone`, log: quiet });
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${proxy.address().port}`;
});
after(() => {
  proxy.close();
  upstream.close();
});

test('forwards the body to TypeSafe with its own key, and nothing from the caller', async () => {
  const res = await fetch(`${base}/v1/systemone`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer stolen', Cookie: 'a=1', 'X-Forwarded-For': '1.2.3.4' }, body: '{"model":"jev-1.14.0"}' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).answers.action.choice, 'move_0');
  const last = seen.at(-1);
  assert.equal(last.body, '{"model":"jev-1.14.0"}');
  assert.equal(last.headers.authorization, `Bearer ${KEY}`);
  assert.equal(last.headers.cookie, undefined);
  assert.equal(last.headers['x-forwarded-for'], undefined);
});

test('only POST /v1/systemone goes out; anything else is a 404', async () => {
  const before = seen.length;
  for (const [method, path] of [['GET', '/v1/systemone'], ['POST', '/v1/models'], ['POST', '/'], ['POST', '/v1/systemone/extra']]) {
    const res = await fetch(base + path, { method, ...(method === 'POST' ? { body: '{}' } : {}) });
    assert.equal(res.status, 404, `${method} ${path}`);
  }
  assert.equal(seen.length, before);
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
});

test('rejects huge bodies and reports TypeSafe errors and outages', async () => {
  assert.equal((await fetch(`${base}/v1/systemone`, { method: 'POST', body: 'x'.repeat(300 * 1024) }).catch(() => ({ status: 413 }))).status, 413);
  upstreamStatus = 529;
  assert.equal((await fetch(`${base}/v1/systemone`, { method: 'POST', body: '{}' })).status, 529);
  upstreamStatus = 200;
  const dead = createJevProxy({ apiKey: KEY, upstream: 'http://127.0.0.1:1/v1/systemone', log: quiet });
  await new Promise((r) => dead.listen(0, '127.0.0.1', r));
  assert.equal((await fetch(`http://127.0.0.1:${dead.address().port}/v1/systemone`, { method: 'POST', body: '{}' })).status, 502);
  dead.close();
});

test('refuses to start without a key', () => {
  assert.throws(() => createJevProxy({}), /JEV_API_KEY/);
});

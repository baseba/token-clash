// Egress proxy for Skynet. The app lives on a network with no route out; this process sits on that
// network and on an outbound one, and forwards exactly one thing: POST /v1/systemone to TypeSafe.
// It holds the Jev key and adds it, so the app never has it. Anything else gets a 404.
//
//   JEV_API_KEY   TypeSafe key (a Podman secret in production). Required.
//   JEV_UPSTREAM  where to forward (default https://api.typesafe.ai/v1/systemone; tests point it elsewhere)
//   PORT          default 8081
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

export const JEV_UPSTREAM = 'https://api.typesafe.ai/v1/systemone';
const MAX_BODY = 256 * 1024; // a Skynet request is a few KB
const MAX_INFLIGHT = 16;
const UPSTREAM_TIMEOUT_MS = 8_000;

const reply = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function createJevProxy({ apiKey: rawKey, upstream = JEV_UPSTREAM, fetchImpl = fetch, log = console } = {}) {
  // A secret made from a file keeps its trailing newline, which would make the header invalid.
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('Falta JEV_API_KEY');
  let inflight = 0;
  return createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (req.method === 'GET' && path === '/healthz') return reply(res, 200, { ok: true });
    if (req.method !== 'POST' || path !== '/v1/systemone') return reply(res, 404, { error: 'not found' });
    if (inflight >= MAX_INFLIGHT) return reply(res, 429, { error: 'busy' });
    inflight++;
    try {
      const body = await readBody(req);
      // Only our own headers go out: nothing from the caller is forwarded but the body.
      const up = await fetchImpl(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const text = await up.text();
      if (!up.ok) log.warn(`jev-proxy: TypeSafe respondió ${up.status}`);
      reply(res, up.status, text);
    } catch (e) {
      if (e.status === 413) return reply(res, 413, { error: 'too large' });
      log.warn(`jev-proxy: ${e?.name === 'TimeoutError' ? 'timeout' : 'sin conexión'} con TypeSafe`);
      if (!res.headersSent) reply(res, 502, { error: 'upstream' });
    } finally {
      inflight--;
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8081);
  createJevProxy({ apiKey: process.env.JEV_API_KEY, upstream: process.env.JEV_UPSTREAM || JEV_UPSTREAM }).listen(port, '0.0.0.0', () =>
    console.log(`jev-proxy escuchando en :${port}`),
  );
  // As PID 1 in the container, Node has no default SIGTERM handler: without this, stopping waits it out.
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => process.exit(0));
}

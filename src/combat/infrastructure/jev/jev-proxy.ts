// Egress proxy for Skynet. The app lives on a network with no route out; this process sits on that
// network and on an outbound one, and forwards exactly one thing: POST /v1/systemone to TypeSafe.
// It holds the Jev key and adds it, so the app never has it. Anything else gets a 404.
//
//   JEV_API_KEY   TypeSafe key (a Podman secret in production). Required.
//   JEV_UPSTREAM  where to forward (default https://api.typesafe.ai/v1/systemone; tests point it elsewhere)
//   PORT          default 8081
//
// It runs as its own process (src/jev-proxy.main.ts), from the same image as the app, and doesn't
// load Nest: it is a few lines of node:http on purpose.
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export const JEV_UPSTREAM = 'https://api.typesafe.ai/v1/systemone';
const MAX_BODY = 256 * 1024; // a Skynet request is a few KB
const MAX_INFLIGHT = 16;
const UPSTREAM_TIMEOUT_MS = 8_000;

const reply = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
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

export interface JevProxyOptions {
  apiKey?: string;
  upstream?: string;
  fetchImpl?: typeof fetch;
  log?: Pick<Console, 'warn'>;
}

export function createJevProxy({ apiKey: rawKey, upstream = JEV_UPSTREAM, fetchImpl = fetch, log = console }: JevProxyOptions = {}): Server {
  // A secret made from a file keeps its trailing newline, which would make the header invalid.
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('Falta JEV_API_KEY');
  let inflight = 0;
  return createServer(async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
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
      const err = e as (Error & { status?: number }) | null;
      if (err?.status === 413) return reply(res, 413, { error: 'too large' });
      log.warn(`jev-proxy: ${err?.name === 'TimeoutError' ? 'timeout' : 'sin conexión'} con TypeSafe`);
      if (!res.headersSent) reply(res, 502, { error: 'upstream' });
    } finally {
      inflight--;
    }
  });
}

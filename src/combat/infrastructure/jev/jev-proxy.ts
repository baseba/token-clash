import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export const JEV_UPSTREAM = 'https://api.typesafe.ai/v1/systemone';
const MAX_BODY = 256 * 1024;
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
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
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
    } catch (error) {
      const err = error as (Error & { status?: number }) | null;
      if (err?.status === 413) return reply(res, 413, { error: 'too large' });
      log.warn(`jev-proxy: ${err?.name === 'TimeoutError' ? 'timeout' : 'sin conexión'} con TypeSafe`);
      if (!res.headersSent) reply(res, 502, { error: 'upstream' });
    } finally {
      inflight--;
    }
  });
}

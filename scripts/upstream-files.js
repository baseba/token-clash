import { upstreamURLs } from '../public/upstream.js';

const HEADERS = { 'user-agent': 'token-clash-importer' };
const CONCURRENCY = 32;

export async function fetchRetry(url, init = {}, { tries = 4, answers = [404] } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { ...init, headers: HEADERS });
      if (response.ok || answers.includes(response.status)) return response;
      throw new Error(`${response.status} ${url}`);
    } catch (error) {
      if (attempt >= tries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

export async function fetchUpstream(upstream, path, init) {
  const [jsdelivr, raw] = upstreamURLs(upstream, path);
  const response = await fetchRetry(jsdelivr, init, { answers: [403, 404] }).catch(() => null);
  return response?.ok ? response : fetchRetry(raw, init);
}

export async function firstExisting(upstream, paths) {
  for (const path of paths) if ((await fetchUpstream(upstream, path, { method: 'HEAD' })).ok) return path;
  return null;
}

export async function mapLimit(items, task) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await task(items[next++]);
    }),
  );
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const entries = (object, indent) =>
  Object.entries(object)
    .map(([key, value]) => `${indent}${JSON.stringify(key)}: ${isObject(value) ? `{\n${entries(value, `${indent}  `)}\n${indent}}` : JSON.stringify(value)}`)
    .join(',\n');

export const manifestJSON = (manifest) => `{\n${entries(manifest, '  ')}\n}\n`;

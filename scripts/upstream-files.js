// How the scripts read the upstream repos of public/upstream.js: at the pinned commit, in the same
// host order as the browser, with retries, and writing manifests a reviewer can diff.
import { upstreamURLs } from '../public/upstream.js';

const HEADERS = { 'user-agent': 'token-clash-importer' };
const CONCURRENCY = 32;

/** A fetch that retries network errors and server failures. A status in `answers` is an answer, not a failure. */
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

/** A file of an upstream repo at its pinned commit. If jsDelivr doesn't have it, raw GitHub's answer is final. */
export async function fetchUpstream(upstream, path, init) {
  const [jsdelivr, raw] = upstreamURLs(upstream, path);
  // jsDelivr answers 403 for a while when a repo goes over its size limit; raw GitHub has the file.
  const response = await fetchRetry(jsdelivr, init, { answers: [403, 404] }).catch(() => null);
  return response?.ok ? response : fetchRetry(raw, init);
}

/** The first of these paths that exists at the pinned commit, or null. The browser never probes: this runs once, here. */
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

/** A manifest as JSON with one entry per line, so regenerating it gives a diff a reviewer can read. */
export const manifestJSON = (manifest) => `{\n${entries(manifest, '  ')}\n}\n`;

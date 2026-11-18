// Sprites, cries, sounds and music that are byte-for-byte copies of files in public GitHub repos are
// not served by us. Our domain answers from a far Cloudflare edge for many players, and every file
// took a long round trip, while jsDelivr answers from nearby. The browser loads each file from
// jsDelivr pinned to a commit (the URL never changes content, so it is cached for a year) and
// retries once at raw.githubusercontent.com if jsDelivr fails. That retry carries real traffic: these
// repos are over jsDelivr's package size limit, and it sometimes answers 403 for a while. The manifests in public/upstream/
// map our keys (a sprite slug, a music track…) to paths inside these repos; the scripts in
// scripts/ resolve them against these same commits.

const JSDELIVR = 'https://cdn.jsdelivr.net';
const RAW = 'https://raw.githubusercontent.com';

/** Where the browser loads upstream files from, for the Content-Security-Policy. */
export const ASSET_ORIGINS = [JSDELIVR, RAW];

/** Each repo we load files from, pinned to a commit: a branch would move under the manifests. */
export const UPSTREAM = {
  sprites: { repo: 'PokeAPI/sprites', commit: 'c0542f7c51215d9672439012838c99f520596cbd' },
  cries: { repo: 'PokeAPI/cries', commit: 'b3a9044bb839b5e3152aaa536c7b463a0fcf0140' },
  pokerogue: { repo: 'pagefaultgames/pokerogue-assets', commit: 'b7ce1013491141864da412fa733d5ac585b5d453' },
};

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

/** The URLs of a file in an upstream repo, in the order to try them: jsDelivr, then raw GitHub. */
export function upstreamURLs({ repo, commit }, path) {
  return [`${JSDELIVR}/gh/${repo}@${commit}/${encodePath(path)}`, `${RAW}/${repo}/${commit}/${encodePath(path)}`];
}

const JSDELIVR_FILE = /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+\/[^/@]+)@([0-9a-f]{40})\/(.+)$/;

/** The raw GitHub URL of a pinned jsDelivr file, or null for any other URL. */
export function rawFallback(url) {
  const match = JSDELIVR_FILE.exec(url);
  return match ? `${RAW}/${match[1]}/${match[2]}/${match[3]}` : null;
}

/**
 * Gives every <img> that fails to load from jsDelivr one retry at raw GitHub, lazy and later ones
 * included. Load errors don't bubble, so the listener runs in the capture phase.
 */
export function fallBackToRaw(doc) {
  doc.addEventListener(
    'error',
    (event) => {
      const fallback = event.target?.tagName === 'IMG' ? rawFallback(event.target.src) : null;
      if (fallback) event.target.src = fallback;
    },
    true,
  );
}

/** The first of these URLs that answers OK, or null if none does. */
export async function fetchFirst(urls, fetchURL = fetch) {
  for (const url of urls) {
    const response = await fetchURL(url).catch(() => null);
    if (response?.ok) return response;
  }
  return null;
}

const manifests = new Map();

/**
 * A manifest of public/upstream/, fetched once per page and shared by every module. It is empty if
 * it can't be read, and the next call tries again. The deploy's version in the URL lets the browser
 * keep it cached.
 */
export function upstreamManifest(name) {
  if (!manifests.has(name)) {
    const manifest = fetch(`/upstream/${name}.json?v=dev`).then((res) => {
      if (!res.ok) throw new Error(`${res.status} /upstream/${name}.json`);
      return res.json();
    });
    manifest.catch(() => manifests.delete(name));
    manifests.set(name, manifest);
  }
  return manifests.get(name).catch(() => ({}));
}

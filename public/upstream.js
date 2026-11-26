const JSDELIVR = 'https://cdn.jsdelivr.net';
const RAW = 'https://raw.githubusercontent.com';

export const ASSET_ORIGINS = [JSDELIVR, RAW];

export const UPSTREAM = {
  sprites: { repo: 'PokeAPI/sprites', commit: 'c0542f7c51215d9672439012838c99f520596cbd' },
  cries: { repo: 'PokeAPI/cries', commit: 'b3a9044bb839b5e3152aaa536c7b463a0fcf0140' },
  pokerogue: { repo: 'pagefaultgames/pokerogue-assets', commit: 'b7ce1013491141864da412fa733d5ac585b5d453' },
  emerald: { repo: 'pret/pokeemerald', commit: '9103e529c2fbdd7add4a1ff3350c6c1f92112c42' },
  firered: { repo: 'pret/pokefirered', commit: 'ce6406d8c2eaf46d543c8a2606de0c3cb1951982' },
  rogue: { repo: 'Pokabbie/pokeemerald-rogue', commit: '5ccb74cf1ef2c0349dfa5d70883b030bbc9ff803' },
  essentials: { repo: 'rh-hideout-chinese/pokemon-engine', commit: '4d4eb60502cf2b347d30d68100f3ef5b54c97c2f' },
};

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

export function upstreamURLs({ repo, commit }, path) {
  return [`${JSDELIVR}/gh/${repo}@${commit}/${encodePath(path)}`, `${RAW}/${repo}/${commit}/${encodePath(path)}`];
}

const JSDELIVR_FILE = /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+\/[^/@]+)@([0-9a-f]{40})\/(.+)$/;

export function rawFallback(url) {
  const match = JSDELIVR_FILE.exec(url);
  return match ? `${RAW}/${match[1]}/${match[2]}/${match[3]}` : null;
}

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

export async function fetchFirst(urls, fetchURL = fetch) {
  for (const url of urls) {
    const response = await fetchURL(url).catch(() => null);
    if (response?.ok) return response;
  }
  return null;
}

const manifests = new Map();

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

#!/usr/bin/env node
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
const RAW = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon';

const DATA = new URL('../server/pokeapi.json', import.meta.url);
const CRIES = new URL('../public/cries/', import.meta.url);

const CONCURRENCY = 16;
const HEADERS = { 'user-agent': 'token-clash-importer' };
const VARIANTS = ['latest', 'legacy'];

async function fetchRetry(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok || res.status === 404) return res;
      throw new Error(`${res.status} ${url}`);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

async function getJson(url) {
  const res = await fetchRetry(url);
  return res.ok ? res.json() : null;
}

async function mapLimit(items, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

const fileFor = (id, variant) =>
  new URL(`${variant}/${id}.ogg`, CRIES);

const complete = (id) =>
  VARIANTS.every((v) => existsSync(fileFor(id, v)));

async function downloadCry(id, variant) {
  const file = fileFor(id, variant);

  if (existsSync(file)) return 'existing';

  const url = `${RAW}/${variant}/${id}.ogg`;
  const res = await fetchRetry(url);

  if (!res.ok) return 'missing';

  const data = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, data);

  return 'downloaded';
}

function speciesTarget(id) {
  return {
    slug: String(id),
    resolveId: async () => Number(id),
  };
}

function formTarget(name) {
  return {
    slug: name,
    resolveId: async () => {
      const form = await getJson(`${API}/pokemon-form/${name}`);
      if (!form?.pokemon?.url) return null;

      const id = Number(
        form.pokemon.url.match(/\/(\d+)\/?$/)?.[1],
      );

      return Number.isInteger(id) && id > 0 ? id : null;
    },
  };
}

export async function syncCries({
  log = (msg) => process.stderr.write(`${msg}\n`),
} = {}) {
  for (const variant of VARIANTS) {
    mkdirSync(new URL(`${variant}/`, CRIES), {
      recursive: true,
    });
  }

  const data = JSON.parse(readFileSync(DATA, 'utf8'));

  const targets = [
    ...Object.keys(data.species).map(speciesTarget),
    ...Object.values(data.forms ?? {})
      .filter((f) => f.sprite)
      .map((f) => formTarget(f.sprite)),
  ];

  log(`Gritos: revisando ${targets.length} Pokémon y formas.`);

  let done = 0;
  let downloaded = 0;
  let existing = 0;
  let unavailable = 0;

  const failed = [];
  const resolved = new Map();

  await mapLimit(targets, async (target) => {
    try {
      const id = await target.resolveId();

      if (!id) {
        throw new Error('sin ID de Pokémon');
      }

      resolved.set(target.slug, id);

      if (complete(id)) {
        existing += VARIANTS.length;
      } else {
        let available = 0;

        for (const variant of VARIANTS) {
          const result = await downloadCry(id, variant);

          if (result === 'downloaded') downloaded++;
          if (result === 'existing') existing++;
          if (result === 'missing') unavailable++;
          else available++;
        }

        if (!available) {
          throw new Error(`sin gritos para ID ${id}`);
        }
      }
    } catch (err) {
      failed.push(`${target.slug} (${err.message})`);
    }

    if (++done % 100 === 0) {
      log(`  ${done}/${targets.length}`);
    }
  });

  const manifest = {};

  for (const [slug, id] of resolved) {
    const cries = {};

    for (const variant of VARIANTS) {
      if (existsSync(fileFor(id, variant))) {
        cries[variant] = `/cries/${variant}/${id}.ogg`;
      }
    }

    if (Object.keys(cries).length) {
      manifest[slug] = cries;
    }
  }

  writeFileSync(
    new URL('cries.json', CRIES),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  log(`Gritos listos en public/cries/`);
  log(`  ${downloaded} archivos nuevos`);
  log(`  ${existing} archivos existentes`);
  log(`  ${unavailable} versiones no disponibles`);
  log(`  ${Object.keys(manifest).length} entradas en cries.json`);

  if (failed.length) {
    throw new Error(
      `No se pudieron procesar ${failed.length} Pokémon: ` +
      failed.slice(0, 10).join(', ') +
      (failed.length > 10 ? '…' : ''),
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncCries().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

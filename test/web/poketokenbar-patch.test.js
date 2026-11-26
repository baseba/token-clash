import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { UPSTREAM } from '../../public/upstream.js';

const patch = readFileSync(new URL('../../public/poketokenbar/gen6-9.patch', import.meta.url), 'utf8');
const installer = readFileSync(new URL('../../public/poketokenbar/install.sh', import.meta.url), 'utf8');
const essentials = JSON.parse(readFileSync(new URL('../../public/upstream/essentials.json', import.meta.url), 'utf8'));

const STRIP = /^\+ {8}(\d+): \.init\(files: (\[[^\]]+\]), delays: \(([\d.]+), ([\d.]+)\)(?:, shinyScale: \((\d+), (\d+)\))?(?:, showdown: \[([^\]]+)\])?\),$/gm;
const strips = new Map([...patch.matchAll(STRIP)].map((match) => [Number(match[1]), {
  files: JSON.parse(match[2]),
  delays: [Math.round(Number(match[3]) * 1000), Math.round(Number(match[4]) * 1000)],
  showdown: match[7] ? JSON.parse(`[${match[7].replaceAll('nil', 'null')}]`) : undefined,
}]));

test('PokeTokenBar animates every species from #650 to #1025 with the strips and delays Token Clash uses', () => {
  const lateSpecies = Object.keys(essentials).filter((slug) => /^\d+$/.test(slug) && Number(slug) >= 650).map(Number);
  assert.deepEqual([...strips.keys()].sort((a, b) => a - b), lateSpecies.sort((a, b) => a - b));
  for (const [id, strip] of strips) {
    const entry = essentials[id];
    assert.deepEqual(strip.files, entry.files, `#${id}`);
    assert.deepEqual(strip.delays, entry.delays, `#${id}`);
    assert.deepEqual(strip.showdown, entry.showdown, `#${id}`);
  }
});

test('PokeTokenBar downloads the Essentials strips from the commit Token Clash pins', () => {
  assert.match(patch, new RegExp(`static let repo = "${UPSTREAM.essentials.repo}"`));
  assert.match(patch, new RegExp(`static let commit = "${UPSTREAM.essentials.commit}"`));
});

test('the installer builds the official tag the patch was made on, checked by commit', () => {
  const commit = /^COMMIT="([0-9a-f]{40})"$/m.exec(installer)?.[1];
  const tag = /^TAG="(v[\d.]+)"$/m.exec(installer)?.[1];
  assert.ok(commit && tag);
  assert.match(patch, /^Subject: \[PATCH 1\/\d+\]/m);
  assert.match(installer, /rev-parse HEAD\)" == "\$COMMIT"/);
  assert.match(installer, /\/poketokenbar\/gen6-9\.patch/);
});

test('the installer builds with an SDK whose SwiftUI macros the Command Line Tools can expand', () => {
  const probe = installer.indexOf('@State private var');
  const sdkroot = installer.indexOf('export SDKROOT="$SDK_PICK"');
  const build = installer.indexOf('./scripts/build-app.sh');
  assert.ok(probe > 0 && probe < sdkroot && sdkroot < build);
  assert.match(installer, /xcrun swiftc -sdk "\$sdk"/);
});

test('PokeTokenBar evolves the same graduates into the same species Token Clash does', async () => {
  const { finalForms } = await import('../../dist/src/catalog/domain/creatures.js');
  const { hash } = await import('../../dist/src/shared/domain/random.js');
  const table = /static let laterFinals: \[Int: \[Int\]\] = \[\n((?:\+ .*\n)+?)\+ {4}\]/.exec(patch)?.[1] ?? '';
  const patched = Object.fromEntries([...table.matchAll(/(\d+): \[([\d, ]+)\]/g)].map((match) => [match[1], match[2].split(', ').map(Number)]));
  const expected = {};
  for (let id = 1; id <= 649; id++) {
    const finals = finalForms(id);
    const later = finals.filter((final) => final !== id);
    if (later.length && finals.every((final) => final === id || final > 649)) expected[id] = later;
  }
  assert.deepEqual(patched, expected);
  assert.equal(`0x${hash('3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90').toString(16).padStart(8, '0')}`, /tokenClashHash\("3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90"\), (0x[0-9a-f]+)\)/.exec(patch)[1]);
});

test('the patched PokeTokenBar keeps writing the file the automatic save sync watches', () => {
  const changed = patch.split('\n').filter((line) => /^[+-](?![+-])/.test(line));
  for (const line of changed) assert.doesNotMatch(line, /companion-state\.json|AppStatePaths|PTB_STATE_DIR|Application Support|CFBundleIdentifier/, line);
  assert.doesNotMatch(installer, /companion-state\.json|LaunchAgents|TokenClash/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { animationSpeeds, delaysOf, essentialsFileId, FORM_FILES, frameDelay, speciesIdsByDex } from '../../scripts/essentials-sprites.mjs';
import { encodeAnimatedPng, matchShinyScale, spriteFilesOf, stripFrames } from '../../scripts/sync-animated-sprites.js';
import { showdownCandidates } from '../../scripts/essentials-sprites.mjs';
import { decodePng } from '../../scripts/sync-trainers.js';

const pokeapi = JSON.parse(readFileSync(new URL('../../src/catalog/data/pokeapi.json', import.meta.url), 'utf8'));
const spritesManifest = JSON.parse(readFileSync(new URL('../../public/upstream/sprites.json', import.meta.url), 'utf8'));
const essentials = JSON.parse(readFileSync(new URL('../../public/upstream/essentials.json', import.meta.url), 'utf8'));

test('an Essentials species file is found by its National Dex number, the order of the PBS species', () => {
  const ids = speciesIdsByDex(['#----\n[BULBASAUR]\nName = A\n[IVYSAUR]\n', '[NIDORANfE]\nName = B\n']);
  assert.deepEqual(ids, ['BULBASAUR', 'IVYSAUR', 'NIDORANfE']);
  assert.equal(essentialsFileId('3', ids), 'NIDORANfE');
  assert.equal(essentialsFileId('4', ids), null);
  assert.equal(essentialsFileId('minior-red', ids), 'MINIOR_7');
  assert.equal(essentialsFileId('pikachu-cosplay', ids), null);
});

test('every form the catalog shows has its Essentials file', () => {
  for (const { sprite } of Object.values(pokeapi.forms)) assert.match(FORM_FILES[sprite] ?? '', /^[A-Z]+_\d+$/, sprite);
});

test('each species animates at its own speed, back first, and a form without one takes its species speed', () => {
  const speeds = animationSpeeds(['[GRENINJA]\nBackSprite = -1,30\nAnimationSpeed = 1\n#---\n[TALONFLAME]\nAnimationSpeed = 3,2\n', '[MINIOR,7]\nAnimationSpeed = 0\n[MINIOR]\nAnimationSpeed = 2,1\n']);
  assert.deepEqual(speeds.get('GRENINJA'), { back: 1, front: 1 });
  assert.deepEqual(speeds.get('TALONFLAME'), { back: 3, front: 2 });
  assert.deepEqual(delaysOf('TALONFLAME', speeds), [frameDelay(2), frameDelay(3)]);
  assert.deepEqual(delaysOf('MINIOR_7', speeds), [0, 0]);
  assert.deepEqual(delaysOf('MINIOR_8', speeds), [frameDelay(1), frameDelay(2)]);
  assert.deepEqual(delaysOf('PIKACHU', speeds), [90, 90], 'the default speed is a frame every 90 ms');
  assert.deepEqual(delaysOf('GRENINJA', speeds), [90, 90], 'a faster species never goes below a frame every 90 ms');
  assert.equal(frameDelay(3), 135);
});

test('the animated sprites cover only what has no Black/White GIF, with four files and two delays each', () => {
  const blackWhite = spritesManifest['sprites/pokemon/versions/generation-v/black-white/animated/'];
  const slugs = Object.keys(essentials);
  assert.ok(slugs.length > 350, `${slugs.length} animated sprites`);
  for (const slug of slugs) {
    assert.equal(blackWhite[slug], undefined, slug);
    assert.equal(essentials[slug].files.length, 4, slug);
    assert.ok(essentials[slug].files.every((file) => /^(Front|Back)( shiny)?\/[A-Za-z0-9_]+\.(png|PNG)$/.test(file)), slug);
    assert.ok(essentials[slug].delays.every((delay) => Number.isInteger(delay) && delay >= 0), slug);
  }
  assert.match(essentials['658'].files[0], /^Front\/GRENINJA\.png$/i);
  assert.match(essentials['906'].files[0], /^Front\/SPRIGATITO\.png$/i);
});

const image = (width, height, opaque) => {
  const rgba = Buffer.alloc(width * height * 4);
  for (const [x, y] of opaque) rgba.writeUInt32BE(0xff0000ff, (y * width + x) * 4);
  return { width, height, rgba };
};

test('a strip splits into square frames, all cropped to the box any frame fills', () => {
  const strip = image(12, 4, [[1, 1], [6, 3], [10, 2]]);
  const frames = stripFrames(strip);
  assert.equal(frames.length, 3);
  for (const frame of frames) assert.deepEqual([frame.width, frame.height], [2, 3]);
  const lit = (frame) => [...Array(frame.width * frame.height).keys()].filter((i) => frame.rgba[i * 4 + 3]).map((i) => [i % frame.width, Math.floor(i / frame.width)]);
  assert.deepEqual(lit(frames[0]), [[0, 0]]);
  assert.deepEqual(lit(frames[1]), [[1, 2]]);
  assert.deepEqual(lit(frames[2]), [[1, 1]]);
});

const chunkTypes = (png) => {
  const types = [];
  for (let at = 8; at < png.length; at += 12 + png.readUInt32BE(at)) types.push(png.toString('latin1', at + 4, at + 8));
  return types;
};

test('the frames become an indexed animated PNG that loops forever, and a still sprite stays a plain PNG', () => {
  const frames = stripFrames(image(12, 4, [[1, 1], [6, 3], [10, 2]]));
  const animated = encodeAnimatedPng(frames, 90);
  assert.deepEqual(chunkTypes(animated), ['IHDR', 'acTL', 'PLTE', 'tRNS', 'fcTL', 'IDAT', 'fcTL', 'fdAT', 'fcTL', 'fdAT', 'IEND']);
  const control = animated.indexOf('acTL') + 4;
  assert.deepEqual([animated.readUInt32BE(control), animated.readUInt32BE(control + 4)], [3, 0]);
  const first = decodePng(animated);
  assert.deepEqual([first.width, first.height], [2, 3]);
  assert.deepEqual(first.rgba, frames[0].rgba, 'a browser without APNG shows the first frame');
  assert.deepEqual(chunkTypes(encodeAnimatedPng(frames, 0)), ['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
  assert.deepEqual(chunkTypes(encodeAnimatedPng(frames.slice(0, 1), 90)), ['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
  assert.deepEqual(decodePng(encodeAnimatedPng(frames, 0)).rgba, frames[0].rgba);
});

test('a sprite with more colors than a palette holds keeps its full color', () => {
  const colorful = { width: 17, height: 17, rgba: Buffer.alloc(17 * 17 * 4) };
  for (let i = 0; i < 17 * 17; i++) colorful.rgba.writeUInt32BE(((i * 7919) << 8) | 0xff, i * 4);
  const png = encodeAnimatedPng([colorful], 90);
  assert.deepEqual(chunkTypes(png), ['IHDR', 'IDAT', 'IEND']);
  assert.deepEqual(decodePng(png).rgba, colorful.rgba);
});

test('a shiny drawn at two or more times its normal size is shrunk back to it, and one at the same size is kept', () => {
  const normal = image(3, 2, [[0, 0], [2, 1]]);
  const tripled = image(9, 6, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [6, 3], [8, 5]]);
  const [front, frontShiny, back, backShiny] = matchShinyScale([[normal], [normal], [normal], [tripled]]);
  assert.equal(frontShiny[0], normal);
  assert.deepEqual([backShiny[0].width, backShiny[0].height], [3, 2]);
  assert.deepEqual(backShiny[0].rgba, normal.rgba);
  assert.equal(front[0], normal);
  assert.equal(back[0], normal);
});

test('a still Essentials front can take the Gen 5 style GIFs Showdown has, and only those variants are copied', () => {
  assert.deepEqual(showdownCandidates('XERNEAS'), ['gen5ani', 'gen5ani-shiny', 'gen5ani-back', 'gen5ani-back-shiny'].map((dir) => `https://play.pokemonshowdown.com/sprites/${dir}/xerneas.gif`));
  const xerneas = { files: ['Front/XERNEAS.png', 'Front shiny/XERNEAS.png', 'Back/XERNEAS.png', 'Back shiny/XERNEAS.png'], delays: [90, 90], showdown: ['https://play.pokemonshowdown.com/sprites/gen5ani/xerneas.gif', 'https://play.pokemonshowdown.com/sprites/gen5ani-shiny/xerneas.gif', null, null] };
  assert.deepEqual(spriteFilesOf('716', xerneas), ['716-front.gif', '716-front-shiny.gif', '716-back.png', '716-back-shiny.png']);
  assert.deepEqual(spriteFilesOf('658', essentials['658']), ['658-front.png', '658-front-shiny.png', '658-back.png', '658-back-shiny.png']);
  assert.ok(Object.values(essentials).every((entry) => !entry.showdown || entry.showdown.every((url) => url === null || url.startsWith('https://play.pokemonshowdown.com/sprites/gen5ani'))));
});

test('a shiny with no strip of its own to compare against is left as it is', () => {
  const normal = image(3, 2, [[0, 0]]);
  const [, frontShiny] = matchShinyScale([null, [normal], [normal], [normal]]);
  assert.equal(frontShiny[0], normal);
});

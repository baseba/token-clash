import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelPreview, tournamentPreview } from './link-preview.js';
import { CARD_HEIGHT, CARD_WIDTH, fittedSize, previewCardSvg, seatGrid, spriteBox, textWidth, type CardArt } from './preview-card.js';

const PICTURE = { uri: 'data:image/png;base64,AAAA', width: 56, height: 80 };
const ART: CardArt = { logo: PICTURE, grass: PICTURE, trainer: (avatar) => (avatar === 'missing' ? null : PICTURE) };

test('a pixel sprite grows by whole steps and stands on the bottom of its area', () => {
  assert.deepEqual(spriteBox(PICTURE, { x: 0, y: 0, width: 260, height: 300 }), { x: 46, y: 60, width: 168, height: 240 });
});

test('a sprite larger than its area shrinks to fit', () => {
  const box = spriteBox(PICTURE, { x: 0, y: 0, width: 28, height: 100 });
  assert.equal(box.width, 28);
  assert.equal(box.height, 40);
});

test('the headline size fits the longest line in the width', () => {
  const size = fittedSize(['Nacho Juan el Gra…', 'te desafía'], 740, 104);
  assert.ok(textWidth('Nacho Juan el Gra…', size) <= 740);
  assert.equal(fittedSize(['Ana'], 740, 104), 104);
});

test('seats lay out in one row up to 8 and in two rows of 8 for 16, inside the area', () => {
  const area = { x: 56, y: 400, width: 1088, height: 170 };
  for (const size of [4, 8, 16]) {
    const seats = seatGrid(size, area);
    assert.equal(seats.length, size);
    assert.equal(new Set(seats.map((seat) => seat.y)).size, size > 8 ? 2 : 1);
    for (const seat of seats) {
      assert.ok(seat.x >= area.x && seat.x + seat.width <= area.x + area.width + 1);
      assert.ok(seat.y >= area.y && seat.y + seat.height <= area.y + area.height + 1);
    }
  }
});

test('the duel card is 1200×630, escapes the name and draws the host', () => {
  const svg = previewCardSvg(duelPreview({ open: true, mode: 'team', visibility: 'private', host: { name: 'Beto <b>', avatar: 'blue' } }).card!, ART);
  assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}"`));
  assert.ok(svg.includes('Beto &lt;b&gt;'));
  assert.ok(!svg.includes('<b>'));
  assert.equal(svg.match(/<image /g)?.length, 3);
});

test('the tournament card draws a seat per place and a question mark on each free one', () => {
  const card = tournamentPreview({ status: 'open', mode: 'random', visibility: 'private', size: 8, host: 'Brock', seats: [{ name: 'Brock', avatar: 'brock' }, { name: 'X', avatar: 'missing' }] }).card!;
  const svg = previewCardSvg(card, ART);
  assert.equal(svg.match(/>\?<\/text>/g)?.length, 6);
  assert.equal(svg.match(/<image /g)?.length, 2);
});

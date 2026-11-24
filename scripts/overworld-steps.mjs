// The walking frames of an overworld sheet that only stands (most gym leaders and the Elite Four of
// the GBA games never walk), learned from the official sheets that do walk. In every walking sheet a
// step is the standing frame one pixel lower, with only the legs and the swinging hands changed (the
// bottom rows): measured on the official walkers, that alone matches 78 % of the pixels of their real
// steps, and this generator 84 %, where the old one (body up, legs mirrored) matched 21 %.
//
// A step is made like this: the body drops a pixel; the official walkers whose standing legs look most
// like these vote, pixel by pixel, on how the legs and hands change; each changed pixel takes its colour
// from this sprite's own standing frame, at the place the walker's pixel moved from; a walker's outline
// becomes this sprite's darkest colour around that place (black for most, dark blue jeans or a dark red
// cap for Red, who has no black outline), and above the feet nothing is erased, so the hands never thin out.

const FRAME = 32;
/** Rows above the feet that a step changes: legs and hands. */
const STEP_ROWS = 10;
/** Rows above the feet where a step may also take pixels away (the feet lifting); above them, hands only move, never vanish. */
const LEG_ROWS = 5;
/** Rows above the feet compared to find walkers with legs like these. */
const MATCH_ROWS = 12;
/** Walkers that vote on each pixel. */
const VOTERS = 5;
/** How much taller or shorter a walker may be and still lend its steps. */
const HEIGHT_GAP = 2;
/** How far (in pixels) a changed pixel is looked for in the walker's standing frame, to find where it moved from. */
const MOVE_REACH = 2;
const LUMA_SPAN = 96;
/** The sheet's groups are up, down, left and right; the right one is the left one mirrored. */
const LEFT = 2;
const RIGHT = 3;

const at = (x, y) => (y * FRAME + x) * 4;
const inside = (x, y) => x >= 0 && y >= 0 && x < FRAME && y < FRAME;
const colourAt = (frame, x, y) => (inside(x, y) && frame[at(x, y) + 3] > 0 ? frame.readUIntBE(at(x, y), 3) : -1);
const luma = (colour) => 0.299 * (colour >> 16) + 0.587 * ((colour >> 8) & 255) + 0.114 * (colour & 255);
const frameOf = (sheet, slot) => sheet.rgba.subarray(slot * FRAME * FRAME * 4, (slot + 1) * FRAME * FRAME * 4);

function paint(frame, x, y, colour) {
  if (colour < 0) frame.fill(0, at(x, y), at(x, y) + 4);
  else frame.set([colour >> 16, (colour >> 8) & 255, colour & 255, 255], at(x, y));
}

function boundsOf(frame) {
  let top = FRAME;
  let bottom = -1;
  let left = FRAME;
  let right = -1;
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++)
      if (frame[at(x, y) + 3]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
  return { top, bottom, middle: Math.round((left + right) / 2), height: bottom - top + 1 };
}

/**
 * The colour a sprite outlines itself with: the commonest one on the edge of its silhouette. Black for
 * most, dark red or dark blue for some (Red); a walker's outline becomes this sprite's own, never another colour.
 */
export function outlineOf(frame) {
  const tally = new Map();
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const colour = colourAt(frame, x, y);
      if (colour < 0) continue;
      const onEdge = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(([nx, ny]) => colourAt(frame, nx, ny) < 0);
      if (onEdge) tally.set(colour, (tally.get(colour) ?? 0) + 1);
    }
  return [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? -1;
}

/** The frame one pixel lower: the body of every step. */
export function dropped(frame) {
  const out = Buffer.alloc(FRAME * FRAME * 4);
  frame.copy(out, FRAME * 4, 0, (FRAME - 1) * FRAME * 4);
  return out;
}

const mirrored = (frame) => {
  const out = Buffer.alloc(FRAME * FRAME * 4);
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) frame.copy(out, at(x, y), at(FRAME - 1 - x, y), at(FRAME - 1 - x, y) + 4);
  return out;
};

/** How alike two standing frames are near the feet, aligned at the feet and the middle: same shape, similar light. */
function likeness(frame, bounds, walker) {
  const dx = bounds.middle - walker.bounds.middle;
  const dy = bounds.bottom - walker.bounds.bottom;
  let score = 0;
  let pixels = 0;
  for (let y = bounds.bottom - MATCH_ROWS; y <= bounds.bottom; y++)
    for (let x = 0; x < FRAME; x++) {
      const own = colourAt(frame, x, y);
      const theirs = colourAt(walker.idle, x - dx, y - dy);
      if (own < 0 && theirs < 0) continue;
      pixels += 1;
      if (own >= 0 && theirs >= 0) score += 1 - Math.min(1, Math.abs(luma(own) - luma(theirs)) / LUMA_SPAN);
    }
  return pixels ? score / pixels : 0;
}

/**
 * What the generator learns from: each official sheet that walks, by direction (up, down, left), with
 * its standing frame, that frame dropped a pixel and its two steps. Built once for every sheet to make.
 */
export function walkersOf(sheets) {
  return [0, 1, LEFT].map((group) =>
    sheets.map((sheet) => {
      const idle = frameOf(sheet, group * 4);
      return { idle, bounds: boundsOf(idle), outline: outlineOf(idle), dropped: dropped(idle), steps: [frameOf(sheet, group * 4 + 1), frameOf(sheet, group * 4 + 2)] };
    }),
  );
}

/** The two steps of a standing frame facing one way (0 up, 1 down, 2 left), from the walkers of that direction. */
export function stepsOf(idle, walkers) {
  const bounds = boundsOf(idle);
  const outline = outlineOf(idle);
  const body = dropped(idle);
  const voters = walkers
    .filter((walker) => Math.abs(walker.bounds.height - bounds.height) <= HEIGHT_GAP && !walker.idle.equals(idle))
    .map((walker) => ({ walker, score: likeness(idle, bounds, walker) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, VOTERS)
    .map(({ walker }) => ({ walker, dx: bounds.middle - walker.bounds.middle, dy: bounds.bottom - walker.bounds.bottom }));
  if (!voters.length) return [body, Buffer.from(body)];
  const movedFrom = (walker, x, y, colour) => {
    for (let reach = 0; reach <= MOVE_REACH; reach++)
      for (let oy = -reach; oy <= reach; oy++)
        for (let ox = -reach; ox <= reach; ox++)
          if (Math.max(Math.abs(ox), Math.abs(oy)) === reach && colourAt(walker.dropped, x + ox, y + oy) === colour) return [ox, oy];
    return null;
  };
  const own = [...new Set(Array.from({ length: FRAME * FRAME }, (_, i) => colourAt(idle, i % FRAME, Math.floor(i / FRAME))).filter((colour) => colour >= 0 && colour !== outline))];
  const darkestNear = (x, y) => {
    let best = -1;
    for (let oy = -MOVE_REACH; oy <= MOVE_REACH; oy++)
      for (let ox = -MOVE_REACH; ox <= MOVE_REACH; ox++) {
        const colour = colourAt(body, x + ox, y + oy);
        if (colour >= 0 && (best < 0 || luma(colour) < luma(best))) best = colour;
      }
    return best >= 0 && luma(best) <= luma(outline) + LUMA_SPAN / 2 ? best : outline;
  };
  const closest = (colour) => own.reduce((best, mine) => (Math.abs(luma(mine) - luma(colour)) < Math.abs(luma(best) - luma(colour)) ? mine : best), own[0]);
  return [0, 1].map((step) => {
    const out = Buffer.from(body);
    for (let y = bounds.bottom + 1 - STEP_ROWS; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        const here = colourAt(body, x, y);
        const votes = new Map();
        for (const { walker, dx, dy } of voters) {
          const [sx, sy] = [x - dx, y - dy];
          const before = colourAt(walker.dropped, sx, sy);
          const after = colourAt(walker.steps[step], sx, sy);
          let vote = here;
          if (before !== after) {
            const from = after < 0 || after === walker.outline ? null : movedFrom(walker, sx, sy, after);
            const mine = from ? colourAt(body, x + from[0], y + from[1]) : -1;
            vote = after < 0 ? -1 : after === walker.outline ? darkestNear(x, y) : mine >= 0 && mine !== outline ? mine : closest(after);
          }
          votes.set(vote, (votes.get(vote) ?? 0) + 1);
        }
        let [winner] = [...votes].sort((a, b) => b[1] - a[1] || (a[0] === here ? -1 : b[0] === here ? 1 : 0))[0];
        if (winner < 0 && here >= 0 && y <= bounds.bottom - LEG_ROWS) winner = here;
        if (winner !== here) paint(out, x, y, winner);
      }
    return out;
  });
}

/**
 * A standing sheet with its steps filled in, for every direction (the right one mirrors the left, as the
 * GBA sheets do). `memo` keeps the steps of each standing frame already made: sheets that share a frame
 * (the same official sprite under two classes) are made once.
 */
export function withSteps(sheet, walkers, memo = new Map()) {
  const out = { width: sheet.width, height: sheet.height, rgba: Buffer.from(sheet.rgba) };
  for (const group of [0, 1, LEFT]) {
    const idle = frameOf(out, group * 4);
    const id = `${group}:${idle.toString('base64')}`;
    if (!memo.has(id)) memo.set(id, stepsOf(idle, walkers[group === LEFT ? 2 : group]));
    memo.get(id).forEach((frame, i) => frame.copy(out.rgba, (group * 4 + 1 + i) * FRAME * FRAME * 4));
  }
  for (let step = 1; step <= 2; step++) mirrored(frameOf(out, LEFT * 4 + step)).copy(out.rgba, (RIGHT * 4 + step) * FRAME * FRAME * 4);
  return out;
}

const FRAME = 32;
const STEP_ROWS = 10;
const LEG_ROWS = 5;
const MATCH_ROWS = 12;
const VOTERS = 5;
const HEIGHT_GAP = 2;
const MOVE_REACH = 2;
const LUMA_SPAN = 96;
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

export function walkersOf(sheets) {
  return [0, 1, LEFT].map((group) =>
    sheets.map((sheet) => {
      const idle = frameOf(sheet, group * 4);
      return { idle, bounds: boundsOf(idle), outline: outlineOf(idle), dropped: dropped(idle), steps: [frameOf(sheet, group * 4 + 1), frameOf(sheet, group * 4 + 2)] };
    }),
  );
}

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

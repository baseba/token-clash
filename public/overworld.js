// Overworld sprites of the Tower: the small walking version of each trainer, from
// public/overworlds/<key>.png (made at install by scripts/sync-overworlds.js). Every sheet is a column
// of 16 frames of 32×32 in four groups (up, down, left, right); each group is idle, step, step, idle.

const GROUPS = { up: 0, down: 4, left: 8, right: 12 };
const WALK = [1, 0, 2, 0];
const STEP_MS = 160;
const FALLBACK = 'player_m';

const sheets = new Map();

/** A sheet, loaded and decoded once per session: drawing it never waits on the network or the decoder. */
function loadSheet(key) {
  if (!sheets.has(key))
    sheets.set(key, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => img.decode().then(() => resolve(img), () => resolve(img));
      img.onerror = () => reject(new Error(key));
      img.src = `/overworlds/${encodeURIComponent(key)}.png?v=dev`;
    }));
  return sheets.get(key);
}

/** Loads the sheets of who is about to show up (the next rivals of a climb), so they walk in already drawn. */
export function preloadOverworlds(keys) {
  for (const key of new Set(keys)) if (key) loadSheet(key).catch(() => {});
}

export function frameIndex(facing, step, walking) {
  return GROUPS[facing] + (walking ? WALK[step % WALK.length] : 0);
}

/** Share of each tile a walker spends on the stepping frame; it stands for the rest, as in the GBA games. */
const STEP_SHARE = 0.5;

/**
 * Where a walker is `elapsed` ms into a walk of `tiles` tiles of `tileMs` each: how far along it is,
 * snapped down to the map's pixels (`pixels` per tile) so pixel art never sits between pixels, and the
 * stepping frame to show (1 or 2, 0 standing). Each tile is one step and the feet alternate, carrying
 * on from `firstFoot` (the steps taken before), so a walk with turns keeps its rhythm.
 */
export function walkPose(elapsed, tiles, firstFoot, { tileMs, pixels }) {
  const done = Math.min(tiles, Math.max(0, elapsed / tileMs));
  const tile = Math.min(tiles - 1, Math.floor(done));
  const stepping = done < tiles && done - Math.floor(done) < STEP_SHARE;
  return { along: done >= tiles ? tiles : Math.floor(done * pixels) / pixels, stride: stepping ? ((firstFoot + tile) % 2 ? 2 : 1) : 0, done: done >= tiles };
}

/**
 * A canvas with the character facing one way, standing or walking in place. It stops on its own
 * once it leaves the page. `set` changes the pose; a `stride` (1 or 2) shows that stepping frame,
 * for a walker whose steps follow its own movement (public/tower-map.js).
 */
export function overworldSprite(key, { facing = 'down', walking = false, scale = 2, cls = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  canvas.className = `ow-sprite${cls ? ` ${cls}` : ''}`;
  canvas.style.width = `${32 * scale}px`;
  canvas.style.height = `${32 * scale}px`;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const pose = { facing, walking };
  let sheet = null;
  let step = 0;
  let timer = null;
  const draw = () => {
    if (!sheet) return;
    ctx.clearRect(0, 0, 32, 32);
    const index = pose.stride ? GROUPS[pose.facing] + pose.stride : frameIndex(pose.facing, step, pose.walking);
    ctx.drawImage(sheet, 0, index * 32, 32, 32, 0, 0, 32, 32);
  };
  const tick = () => {
    if (!canvas.isConnected && step > 2) {
      clearInterval(timer);
      timer = null;
      return;
    }
    step += 1;
    if (pose.walking) draw();
  };
  const start = (loaded) => {
    sheet = loaded;
    draw();
    timer = setInterval(tick, STEP_MS);
  };
  loadSheet(key).then(start, () => (key === FALLBACK ? canvas.classList.add('ow-missing') : loadSheet(FALLBACK).then(start, () => canvas.classList.add('ow-missing'))));
  canvas.set = (next) => {
    Object.assign(pose, next);
    draw();
  };
  return canvas;
}

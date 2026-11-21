// Overworld sprites of the Tower: the small walking version of each trainer, from
// public/overworlds/<key>.png (made at install by scripts/sync-overworlds.js). Every sheet is a column
// of 16 frames of 32×32 in four groups (up, down, left, right); each group is idle, step, step, idle.

const GROUPS = { up: 0, down: 4, left: 8, right: 12 };
const WALK = [1, 0, 2, 0];
const STEP_MS = 160;
const FALLBACK = 'player_m';

const sheets = new Map();

function loadSheet(key) {
  if (!sheets.has(key))
    sheets.set(key, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(key));
      img.src = `/overworlds/${encodeURIComponent(key)}.png?v=dev`;
    }));
  return sheets.get(key);
}

export function frameIndex(facing, step, walking) {
  return GROUPS[facing] + (walking ? WALK[step % WALK.length] : 0);
}

/**
 * A canvas with the character facing one way, standing or walking in place. It stops on its own
 * once it leaves the page. `set` changes the pose.
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
    ctx.drawImage(sheet, 0, frameIndex(pose.facing, step, pose.walking) * 32, 32, 32, 0, 0, 32, 32);
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

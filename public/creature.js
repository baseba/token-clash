// Draws an original creature from the numbers the server sends. No images, no external art.
export const ELEMENTS = {
  brasa: { label: 'Brasa', hue: 14, sat: 85, icon: '🔥' },
  marea: { label: 'Marea', hue: 205, sat: 75, icon: '🌊' },
  brote: { label: 'Brote', hue: 118, sat: 55, icon: '🌱' },
  chispa: { label: 'Chispa', hue: 48, sat: 95, icon: '⚡' },
  roca: { label: 'Roca', hue: 30, sat: 35, icon: '🪨' },
  sombra: { label: 'Sombra', hue: 272, sat: 45, icon: '🌑' },
};
export const BEATS = { brasa: 'brote', brote: 'marea', marea: 'brasa', chispa: 'sombra', sombra: 'roca', roca: 'chispa' };
export function effectiveness(a, d) {
  if (!a || !d) return 1;
  if (BEATS[a] === d) return 1.5;
  if (BEATS[d] === a) return 0.67;
  return 1;
}

const n = (v) => Number(v) || 0;

export function creatureSVG(f, { flip = false } = {}) {
  const look = f.look || {};
  const el = ELEMENTS[f.element] || ELEMENTS.roca;
  let hue = (el.hue + n(look.hueShift) + 360) % 360;
  if (f.shiny) hue = (hue + 150) % 360;
  const sat = el.sat;
  const main = `hsl(${hue} ${sat}% 58%)`;
  const dark = `hsl(${hue} ${sat}% 36%)`;
  const light = `hsl(${hue} ${Math.max(20, sat - 25)}% 84%)`;
  const accent = `hsl(${(hue + 40) % 360} ${Math.min(100, sat + 10)}% 62%)`;
  const ink = '#1d1a2b';

  const bodies = [
    { cx: 60, cy: 70, rx: 34, ry: 31 },
    { cx: 60, cy: 66, rx: 27, ry: 37 },
    { cx: 60, cy: 74, rx: 41, ry: 27 },
    { cx: 60, cy: 70, rx: 33, ry: 33, pear: true },
  ];
  const b = bodies[n(look.body) % 4];
  const top = b.cy - b.ry;
  const parts = [];

  // tail, behind the body
  const tx = b.cx + b.rx - 6;
  const ty = b.cy + 6;
  switch (n(look.tail)) {
    case 1:
      parts.push(`<path d="M${tx} ${ty} q22 -4 20 -26 q-2 -10 8 -12" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round"/>`);
      break;
    case 2:
      parts.push(`<path d="M${tx - 4} ${ty + 6} L${tx + 26} ${ty - 22} L${tx + 8} ${ty - 2} L${tx + 28} ${ty - 4} Z" fill="${accent}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/>`);
      break;
    case 3:
      parts.push(`<circle cx="${tx + 12}" cy="${ty - 4}" r="12" fill="${light}" stroke="${dark}" stroke-width="2.5"/>`);
      break;
  }

  // ears
  const ex = b.rx * 0.55;
  const earL = b.cx - ex;
  const earR = b.cx + ex;
  const ey = top + 8;
  switch (n(look.ears)) {
    case 1:
      for (const x of [earL, earR]) {
        const d = x < b.cx ? -1 : 1;
        parts.push(`<path d="M${x - 9} ${ey + 6} L${x + d * 6} ${ey - 24} L${x + 10} ${ey + 4} Z" fill="${main}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/>`);
        parts.push(`<path d="M${x - 4} ${ey + 2} L${x + d * 5} ${ey - 14} L${x + 5} ${ey + 1} Z" fill="${light}"/>`);
      }
      break;
    case 2:
      for (const x of [earL, earR]) parts.push(`<circle cx="${x}" cy="${ey - 4}" r="11" fill="${main}" stroke="${dark}" stroke-width="2.5"/><circle cx="${x}" cy="${ey - 4}" r="5.5" fill="${light}"/>`);
      break;
    case 3:
      for (const x of [earL + 4, earR - 4]) {
        const d = x < b.cx ? -1 : 1;
        parts.push(`<path d="M${x} ${ey + 4} q${d * 4} -18 ${d * 12} -24" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round"/><circle cx="${x + d * 12}" cy="${ey - 20}" r="5" fill="${accent}" stroke="${dark}" stroke-width="2"/>`);
      }
      break;
    case 4:
      for (const x of [earL, earR]) {
        const d = x < b.cx ? -1 : 1;
        parts.push(`<path d="M${x - 5} ${ey + 4} q${d * 2} -14 ${d * 14} -20 q${-d * 6} 10 ${-d * 4} 22 Z" fill="${light}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/>`);
      }
      break;
    case 5:
      parts.push(`<path d="M${b.cx} ${top + 4} q-4 -22 14 -28 q2 18 -14 28 Z" fill="${accent}" stroke="${dark}" stroke-width="2.5" stroke-linejoin="round"/><path d="M${b.cx} ${top + 4} q6 -12 12 -24" fill="none" stroke="${dark}" stroke-width="1.5"/>`);
      break;
  }

  // feet
  if (look.feet) {
    for (const x of [b.cx - b.rx * 0.5, b.cx + b.rx * 0.5]) parts.push(`<ellipse cx="${x}" cy="${b.cy + b.ry - 2}" rx="10" ry="6" fill="${dark}"/>`);
  }

  // body
  if (b.pear) {
    parts.push(`<path d="M${b.cx} ${top} C${b.cx + 22} ${top} ${b.cx + 18} ${b.cy - 6} ${b.cx + b.rx} ${b.cy + 12} C${b.cx + b.rx + 4} ${b.cy + b.ry} ${b.cx - b.rx - 4} ${b.cy + b.ry} ${b.cx - b.rx} ${b.cy + 12} C${b.cx - 18} ${b.cy - 6} ${b.cx - 22} ${top} ${b.cx} ${top} Z" fill="${main}" stroke="${dark}" stroke-width="3"/>`);
  } else {
    parts.push(`<ellipse cx="${b.cx}" cy="${b.cy}" rx="${b.rx}" ry="${b.ry}" fill="${main}" stroke="${dark}" stroke-width="3"/>`);
  }

  // pattern
  switch (n(look.pattern)) {
    case 1:
      parts.push(`<circle cx="${b.cx - b.rx * 0.55}" cy="${b.cy + 4}" r="4" fill="${dark}" opacity=".45"/><circle cx="${b.cx + b.rx * 0.6}" cy="${b.cy - 2}" r="5" fill="${dark}" opacity=".45"/><circle cx="${b.cx + b.rx * 0.4}" cy="${b.cy + b.ry * 0.55}" r="3" fill="${dark}" opacity=".45"/>`);
      break;
    case 2:
      parts.push(`<ellipse cx="${b.cx}" cy="${b.cy + b.ry * 0.38}" rx="${b.rx * 0.55}" ry="${b.ry * 0.48}" fill="${light}"/>`);
      break;
    case 3:
      for (const dx of [-10, 0, 10]) parts.push(`<path d="M${b.cx + dx - 4} ${top + 2} q4 8 0 14" fill="none" stroke="${dark}" stroke-width="3" stroke-linecap="round" opacity=".6"/>`);
      break;
  }

  // face
  const fy = b.cy - b.ry * 0.12;
  const gap = Math.min(15, b.rx * 0.42);
  switch (n(look.eyes)) {
    case 0:
      for (const x of [b.cx - gap, b.cx + gap]) parts.push(`<circle cx="${x}" cy="${fy}" r="5" fill="${ink}"/><circle cx="${x + 1.6}" cy="${fy - 1.8}" r="1.7" fill="#fff"/>`);
      break;
    case 1:
      for (const x of [b.cx - gap, b.cx + gap]) parts.push(`<ellipse cx="${x}" cy="${fy}" rx="6.5" ry="8" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${x + 1}" cy="${fy + 1}" r="4.2" fill="${accent}"/><circle cx="${x + 1}" cy="${fy + 1}" r="2.2" fill="${ink}"/><circle cx="${x + 2.4}" cy="${fy - 2}" r="1.4" fill="#fff"/>`);
      break;
    default:
      for (const x of [b.cx - gap, b.cx + gap]) parts.push(`<path d="M${x - 5} ${fy} q5 -5 10 0" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`);
  }
  parts.push(`<ellipse cx="${b.cx - gap - 5}" cy="${fy + 9}" rx="4.5" ry="2.6" fill="#ff8fa3" opacity=".55"/><ellipse cx="${b.cx + gap + 5}" cy="${fy + 9}" rx="4.5" ry="2.6" fill="#ff8fa3" opacity=".55"/>`);
  const my = fy + 11;
  switch (n(look.mouth)) {
    case 0:
      parts.push(`<path d="M${b.cx - 5} ${my} q5 5 10 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`);
      break;
    case 1:
      parts.push(`<path d="M${b.cx - 6} ${my} q3 3 6 0 q3 3 6 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`);
      break;
    default:
      parts.push(`<path d="M${b.cx - 6} ${my - 1} q6 9 12 0 Z" fill="${ink}"/><path d="M${b.cx - 4} ${my - 1} l1.5 3 l1.5 -3 Z" fill="#fff"/>`);
  }

  if (f.rarity === 'legendary') parts.unshift(`<ellipse cx="${b.cx}" cy="${top - 12}" rx="20" ry="5" fill="none" stroke="#ffd34d" stroke-width="3" opacity=".9"/>`);
  if (f.shiny) {
    const star = (x, y, r) => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="#fff6b0" class="sparkle"/>`;
    parts.push(star(18, 26, 7), star(102, 40, 5), star(96, 104, 6));
  }

  const shadow = `<ellipse cx="60" cy="${b.cy + b.ry + 4}" rx="${b.rx * 0.9}" ry="5" fill="#000" opacity=".18"/>`;
  return `<svg viewBox="0 0 120 120" class="creature" aria-hidden="true">${shadow}<g${flip ? ' transform="translate(120 0) scale(-1 1)"' : ''}>${parts.join('')}</g></svg>`;
}

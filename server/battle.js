// Turn-based battle engine. Pure: no I/O, randomness injected, so it can be tested and replayed.
import { buildFighter, effectiveness } from './creatures.js';

export const TEAM_SIZE = 3;
const STAGE_MAX = 3;

const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

function prepare(entry, levelCap) {
  const f = buildFighter(entry, { levelCap });
  return {
    ...f,
    hp: f.stats.hp,
    boosts: { atk: 0, def: 0 },
    uses: Object.fromEntries(f.moves.filter((m) => m.uses).map((m) => [m.key, m.uses])),
  };
}

export function createBattle({ id, sides, levelCap = null, random = Math.random }) {
  return {
    id,
    levelCap,
    random,
    status: 'active',
    phase: 'choose', // choose: both pick; replace: sides whose fighter fainted pick a replacement
    turn: 1,
    winner: null,
    sides: sides.map((s) => ({
      trainerId: s.trainerId,
      name: s.name,
      team: s.entries.slice(0, TEAM_SIZE).map((e) => prepare(e, levelCap)),
      active: 0,
      action: null,
      mustSwitch: false,
    })),
  };
}

export function needsAction(b, s) {
  if (b.status !== 'active') return false;
  const side = b.sides[s];
  if (side.action) return false;
  return b.phase === 'choose' ? true : side.mustSwitch;
}

export function validActions(b, s) {
  if (!needsAction(b, s)) return [];
  const side = b.sides[s];
  const out = [];
  const switches = side.team.map((f, i) => ({ type: 'switch', to: i })).filter((a) => a.to !== side.active && side.team[a.to].hp > 0);
  if (b.phase === 'replace') return switches;
  const f = side.team[side.active];
  f.moves.forEach((m, i) => {
    if (m.uses && (f.uses[m.key] ?? 0) <= 0) return;
    out.push({ type: 'move', move: i });
  });
  return out.concat(switches);
}

const sameAction = (a, b) => a.type === b.type && (a.type === 'move' ? a.move === b.move : a.to === b.to);

// Returns the events of the resolved turn, or null if still waiting on the other side.
export function submit(b, s, action) {
  if (!action || !validActions(b, s).some((v) => sameAction(v, action))) throw new Error('Acción inválida');
  b.sides[s].action = action.type === 'move' ? { type: 'move', move: action.move } : { type: 'switch', to: action.to };
  if (b.sides.some((_, i) => needsAction(b, i))) return null;
  return b.phase === 'choose' ? resolveTurn(b) : resolveReplacements(b);
}

export function autoAction(b, s) {
  const opts = validActions(b, s);
  if (!opts.length) return null;
  const moves = opts.filter((o) => o.type === 'move');
  if (moves.length) {
    const side = b.sides[s];
    const me = side.team[side.active];
    const foe = b.sides[1 - s].team[b.sides[1 - s].active];
    let best = moves[0];
    let bestScore = -1;
    for (const o of moves) {
      const m = me.moves[o.move];
      const score = (m.power || 20) * effectiveness(m.element, foe.element) * (m.accuracy / 100) + b.random() * 10;
      if (score > bestScore) [best, bestScore] = [o, score];
    }
    return best;
  }
  return opts[Math.floor(b.random() * opts.length)];
}

function doSwitch(b, s, to, events) {
  const side = b.sides[s];
  const old = side.team[side.active];
  old.boosts = { atk: 0, def: 0 };
  side.active = to;
  events.push({ t: 'switch', side: s, to, name: side.team[to].name });
}

function speedOf(f) {
  return f.stats.spd;
}

function useMove(b, s, moveIdx, events) {
  const side = b.sides[s];
  const foeSide = b.sides[1 - s];
  const me = side.team[side.active];
  const foe = foeSide.team[foeSide.active];
  if (me.hp <= 0) return;
  const m = me.moves[moveIdx];
  events.push({ t: 'move', side: s, name: me.name, move: m.name, element: m.element });

  if (m.kind === 'boost') {
    const cur = me.boosts[m.stat];
    if (cur >= STAGE_MAX) {
      events.push({ t: 'nothing', side: s });
      return;
    }
    me.boosts[m.stat] = cur + 1;
    events.push({ t: 'boost', side: s, stat: m.stat, stage: me.boosts[m.stat] });
    return;
  }
  if (m.kind === 'heal') {
    me.uses[m.key] = (me.uses[m.key] ?? 0) - 1;
    const amount = Math.min(me.stats.hp - me.hp, Math.round(me.stats.hp * m.amount));
    me.hp += amount;
    events.push({ t: 'heal', side: s, amount, hp: me.hp });
    return;
  }

  if (b.random() * 100 >= m.accuracy) {
    events.push({ t: 'miss', side: s });
    return;
  }
  const a = me.stats.atk * stageMult(me.boosts.atk);
  const d = foe.stats.def * stageMult(foe.boosts.def);
  const eff = effectiveness(m.element, foe.element);
  const crit = b.random() < 1 / 16;
  const roll = 0.85 + b.random() * 0.15;
  const own = m.element && m.element === me.element ? 1.15 : 1;
  const dmg = Math.max(1, Math.round(m.power * (a / (a + d)) * (0.5 + me.level / 70) * eff * own * roll * (crit ? 1.5 : 1)));
  foe.hp = Math.max(0, foe.hp - dmg);
  events.push({ t: 'damage', side: 1 - s, amount: dmg, hp: foe.hp, eff, crit });
  if (foe.hp === 0) events.push({ t: 'faint', side: 1 - s, name: foe.name });
}

function alive(side) {
  return side.team.some((f) => f.hp > 0);
}

function checkEnd(b, events) {
  const lost = b.sides.map((side) => !alive(side));
  if (!lost[0] && !lost[1]) return false;
  b.status = 'finished';
  b.winner = lost[0] && lost[1] ? null : lost[0] ? 1 : 0;
  events.push({ t: 'end', winner: b.winner });
  return true;
}

function resolveTurn(b) {
  const events = [{ t: 'turn', turn: b.turn }];
  const acts = b.sides.map((side, s) => ({ s, ...side.action }));
  for (const side of b.sides) side.action = null;

  for (const a of acts) if (a.type === 'switch') doSwitch(b, a.s, a.to, events);

  const movers = acts
    .filter((a) => a.type === 'move')
    .map((a) => {
      const side = b.sides[a.s];
      const f = side.team[side.active];
      return { ...a, prio: f.moves[a.move].priority, spd: speedOf(f), tie: b.random() };
    })
    .sort((x, y) => y.prio - x.prio || y.spd - x.spd || y.tie - x.tie);

  for (const a of movers) {
    useMove(b, a.s, a.move, events);
    if (checkEnd(b, events)) return events;
  }
  b.turn += 1;
  afterTurn(b, events);
  return events;
}

function afterTurn(b, events) {
  let anyReplace = false;
  b.sides.forEach((side, s) => {
    side.mustSwitch = side.team[side.active].hp <= 0;
    if (side.mustSwitch) {
      anyReplace = true;
      events.push({ t: 'replace', side: s });
    }
  });
  b.phase = anyReplace ? 'replace' : 'choose';
}

function resolveReplacements(b) {
  const events = [];
  b.sides.forEach((side, s) => {
    if (side.mustSwitch && side.action) doSwitch(b, s, side.action.to, events);
    side.action = null;
    side.mustSwitch = false;
  });
  b.phase = 'choose';
  return events;
}

// What a client may see. Pending choices stay hidden; only "ready" is shown.
export function publicState(b) {
  return {
    id: b.id,
    status: b.status,
    phase: b.phase,
    turn: b.turn,
    winner: b.winner,
    levelCap: b.levelCap,
    sides: b.sides.map((side, s) => ({
      trainerId: side.trainerId,
      name: side.name,
      active: side.active,
      ready: !needsAction(b, s),
      mustSwitch: side.mustSwitch,
      team: side.team.map((f) => ({
        uid: f.uid,
        name: f.name,
        speciesName: f.speciesName,
        element: f.element,
        rarity: f.rarity,
        shiny: f.shiny,
        level: f.level,
        stats: f.stats,
        hp: f.hp,
        boosts: f.boosts,
        uses: f.uses,
        look: f.look,
        moves: f.moves.map((m) => ({ name: m.name, element: m.element, power: m.power, accuracy: m.accuracy, priority: m.priority, kind: m.kind || 'attack', desc: m.desc, key: m.key })),
      })),
    })),
  };
}

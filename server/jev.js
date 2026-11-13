// Skynet: each turn, Jev (TypeSafe's decision model) picks the AI's action.
// Jev only sees what a human player on that side would see (publicState), never the rival's
// hidden Pokémon, moves, stats or pending choice, and never trainer names or nicknames.
import { publicState, validActions, STRUGGLE_MOVE } from './battle.js';
import { effectiveness } from './creatures.js';

// In production this points at the egress proxy (server/jev-proxy.js), which adds the key.
export const JEV_URL = process.env.JEV_API_URL || 'https://api.typesafe.ai/v1/systemone';
// Skynet exists when there is a way to reach Jev: a key for TypeSafe directly, or a proxy URL.
export const jevConfigured = (env = process.env) => Boolean(env.JEV_API_KEY || env.JEV_API_URL);
// Pinned, not jev-latest, so a model update can't silently change how Skynet plays.
export const JEV_MODEL = process.env.JEV_MODEL || 'jev-1.14.0';
const JEV_TIMEOUT_MS = 4_000;

const STATUS_NAME = { par: 'paralyzed', brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep', frz: 'frozen' };

const nonZero = (o = {}) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));
const pct = (f) => (f.hpPercent ? f.hp : Math.round((f.hp / f.stats.hp) * 100));

function moveFacts(m, user, foe, ppLeft) {
  const facts = { name: m.name, type: m.type, category: m.category };
  if (m.kind !== 'status') {
    facts.power = m.power || (m.fixedDamage ? `fixed (${m.fixedDamage})` : null);
    if (m.type && user?.types.includes(m.type)) facts.sameTypeBonus = true;
    if (foe && m.type) facts.effectivenessVsOpponent = `x${effectiveness(m.type, foe.types)}`;
  } else {
    facts.effect = m.desc;
  }
  facts.accuracy = m.accuracy ?? 'never misses';
  if (m.priority) facts.priority = m.priority;
  if (ppLeft != null) facts.ppLeft = ppLeft;
  return facts;
}

function monFacts(f, { own, foe }) {
  if (f.hidden) return { unknown: true };
  const out = {
    species: f.speciesName,
    types: f.types,
    level: f.level,
    hpPercent: pct(f),
    ...(own ? { hp: `${f.hp}/${f.stats.hp}` } : {}),
    ...(f.status ? { status: STATUS_NAME[f.status] ?? f.status } : {}),
    ...(Object.keys(nonZero(f.boosts)).length ? { statStages: nonZero(f.boosts) } : {}),
    ...(Object.keys(f.volatiles ?? {}).length ? { conditions: f.volatiles } : {}),
  };
  if (own) out.stats = { attack: f.stats.atk, defense: f.stats.def, spAttack: f.stats.satk, spDefense: f.stats.sdef, speed: f.stats.spd };
  if (f.abilityInfo) out.ability = { name: f.abilityInfo.name, effect: f.abilityInfo.desc };
  if (f.moves.length) out[own ? 'moves' : 'revealedMoves'] = f.moves.map((m) => moveFacts(m, f, foe, own ? f.pp[m.key] : null));
  return out;
}

export function jevState(b, s) {
  const view = publicState(b, s);
  const mine = view.sides[s];
  const theirs = view.sides[1 - s];
  const foe = theirs.team[theirs.active];
  const foeActive = foe && !foe.hidden && foe.hp > 0 ? foe : null;
  const me = mine.team[mine.active];
  return {
    game: 'Turn-based Pokémon singles battle, 3 Pokémon per side. Both sides choose at the same time; the faster Pokémon moves first unless a move has higher priority. You win when every rival Pokémon has fainted.',
    you: 'You control side "mine". You cannot see the rival\'s choice for this turn, nor rival Pokémon or moves that have not been revealed yet.',
    turn: view.turn,
    situation: view.phase === 'replace' ? 'Your active Pokémon fainted: choose which one to send in.' : 'Choose your action for this turn.',
    field: nonZero({ weather: view.field.weather, terrain: view.field.terrain }),
    mine: {
      active: me.hp > 0 ? monFacts(me, { own: true, foe: foeActive }) : { fainted: monFacts(me, { own: true }).species },
      bench: mine.team.filter((_, i) => i !== mine.active).map((f) => (f.hp > 0 ? monFacts(f, { own: true, foe: foeActive }) : { species: f.speciesName, fainted: true })),
      ...(Object.keys(nonZero(mine.screens)).length ? { screens: nonZero(mine.screens) } : {}),
    },
    rival: {
      active: foeActive ? monFacts(foeActive, { own: false }) : null,
      others: theirs.team.filter((_, i) => i !== theirs.active).map((f) => (f.hidden ? { unknown: true } : f.hp > 0 ? monFacts(f, { own: false }) : { species: f.speciesName, fainted: true })),
      ...(Object.keys(nonZero(theirs.screens)).length ? { screens: nonZero(theirs.screens) } : {}),
    },
  };
}

// The valid actions as Choice criteria. Keys map back to the action the engine expects.
export function jevOptions(b, s) {
  const view = publicState(b, s);
  const mine = view.sides[s];
  const theirs = view.sides[1 - s];
  const me = mine.team[mine.active];
  const foeRaw = theirs.team[theirs.active];
  const foe = foeRaw && !foeRaw.hidden && foeRaw.hp > 0 ? foeRaw : null;
  const criteria = {};
  const actions = {};
  for (const a of validActions(b, s)) {
    if (a.type === 'move') {
      const key = a.move === STRUGGLE_MOVE ? 'struggle' : `move_${a.move}`;
      actions[key] = a;
      criteria[key] = a.move === STRUGGLE_MOVE
        ? { action: 'Struggle (no PP left in any move): weak attack that also hurts you' }
        : { action: `Use ${me.moves[a.move].name}`, ...moveFacts(me.moves[a.move], me, foe, me.pp[me.moves[a.move].key]) };
    } else {
      const f = mine.team[a.to];
      const key = `switch_${a.to}`;
      actions[key] = a;
      criteria[key] = {
        action: `Switch to ${f.speciesName}`,
        types: f.types,
        hpPercent: pct(f),
        ...(f.status ? { status: STATUS_NAME[f.status] ?? f.status } : {}),
        ...(foe ? { worstRivalTypeVsIt: `x${Math.max(...foe.types.map((t) => effectiveness(t, f.types)))}` } : {}),
        ...(foe ? { bestMoveVsRival: `x${Math.max(0, ...f.moves.filter((m) => m.kind !== 'status' && m.type).map((m) => effectiveness(m.type, foe.types)))}` } : {}),
      };
    }
  }
  return { criteria, actions };
}

// Asks Jev; resolves to { key, confidence } or throws with a short reason (never the key or body).
export async function askJev({ apiKey, state, criteria, fetchImpl = fetch, timeoutMs = JEV_TIMEOUT_MS }) {
  let res;
  try {
    res = await fetchImpl(JEV_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model: JEV_MODEL,
        state,
        questions: {
          action: {
            type: 'choice',
            instructions: 'You are an expert Pokémon battler playing side "mine". Which action gives you the best chance to win the battle? Weigh damage, type effectiveness, speed, HP, status and the risk of being knocked out.',
            criteria,
          },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error(e?.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body = await res.json().catch(() => null);
  const answer = body?.answers?.action;
  if (!answer || typeof answer.choice !== 'string' || !Object.hasOwn(criteria, answer.choice)) throw new Error('bad answer');
  return { key: answer.choice, confidence: answer.confidence ?? null };
}

// The action Jev picks for side s, or null if Jev can't decide (error, timeout, bad answer).
// Without apiKey no Authorization is sent: the proxy adds it.
export async function chooseJevAction(b, s, { apiKey, fetchImpl, timeoutMs } = {}) {
  try {
    const { criteria, actions } = jevOptions(b, s);
    const keys = Object.keys(criteria);
    if (!keys.length) return null;
    if (keys.length === 1) return actions[keys[0]];
    const { key } = await askJev({ apiKey, state: jevState(b, s), criteria, fetchImpl, timeoutMs });
    return actions[key];
  } catch (e) {
    console.warn(`Skynet: Jev no respondió (${e.message}), decide la IA Muy difícil.`);
    return null;
  }
}

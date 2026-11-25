import { publicState, validActions, STRUGGLE_MOVE, type Action, type BattleState, type FighterView, type PublicMove, type VisibleFighterView } from '../../domain/battle.js';
import { effectiveness } from '../../../catalog/domain/creatures.js';

export const JEV_DEFAULT_URL = 'https://api.typesafe.ai/v1/systemone';
export const JEV_DEFAULT_MODEL = 'jev-1.14.0';
export const JEV_TIMEOUT_MS = 4_000;

export interface JevOptions {
  url?: string;
  model?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Facts = Record<string, unknown>;

const isVisible = (view: FighterView | null | undefined): view is VisibleFighterView => !!view && !view.hidden;

const STATUS_NAME: Record<string, string> = { par: 'paralyzed', brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep', frz: 'frozen' };

const nonZero = (values: object = {}): Record<string, unknown> => Object.fromEntries(Object.entries(values).filter(([, v]) => v));
const pct = (view: VisibleFighterView): number => (view.hpPercent ? view.hp : Math.round((view.hp / view.stats.hp) * 100));

function moveFacts(move: PublicMove, user: VisibleFighterView | null, foe: VisibleFighterView | null, ppLeft: number | null | undefined): Facts {
  const facts: Facts = { name: move.name, type: move.type, category: move.category };
  if (move.kind !== 'status') {
    facts.power = move.power || (move.fixedDamage ? `fixed (${move.fixedDamage})` : null);
    if (move.type && user?.types.includes(move.type)) facts.sameTypeBonus = true;
    if (foe && move.type) facts.effectivenessVsOpponent = `x${effectiveness(move.type, foe.types)}`;
  } else {
    facts.effect = move.desc;
  }
  facts.accuracy = move.accuracy ?? 'never misses';
  if (move.priority) facts.priority = move.priority;
  if (ppLeft != null) facts.ppLeft = ppLeft;
  return facts;
}

function monFacts(view: FighterView, { own, foe = null }: { own: boolean; foe?: VisibleFighterView | null }): Facts {
  if (!isVisible(view)) return { unknown: true };
  const out: Facts = {
    species: view.speciesName,
    types: view.types,
    level: view.level,
    hpPercent: pct(view),
    ...(own ? { hp: `${view.hp}/${view.stats.hp}` } : {}),
    ...(view.status ? { status: STATUS_NAME[view.status] ?? view.status } : {}),
    ...(Object.keys(nonZero(view.boosts)).length ? { statStages: nonZero(view.boosts) } : {}),
    ...(Object.keys(view.volatiles ?? {}).length ? { conditions: view.volatiles } : {}),
  };
  if (own)
    out.stats = { attack: view.stats.atk, defense: view.stats.def, spAttack: view.stats.satk, spDefense: view.stats.sdef, speed: view.stats.spd };
  if (view.abilityInfo) out.ability = { name: view.abilityInfo.name, effect: view.abilityInfo.desc };
  if (view.moves.length) out[own ? 'moves' : 'revealedMoves'] = view.moves.map((m) => moveFacts(m, view, foe, own ? view.pp[m.key] : null));
  return out;
}

export function jevState(battle: BattleState, sideIndex: number): Facts {
  const view = publicState(battle, sideIndex);
  const mine = view.sides[sideIndex];
  const theirs = view.sides[1 - sideIndex];
  const foe = theirs.team[theirs.active];
  const foeActive = isVisible(foe) && foe.hp > 0 ? foe : null;
  const me = mine.team[mine.active] as VisibleFighterView;
  return {
    game: 'Turn-based Pokémon singles battle, 3 Pokémon per side. Both sides choose at the same time; the faster Pokémon moves first unless a move has higher priority. You win when every rival Pokémon has fainted.',
    you: 'You control side "mine". You cannot see the rival\'s choice for this turn, nor rival Pokémon or moves that have not been revealed yet.',
    turn: view.turn,
    situation: view.phase === 'replace' ? 'Your active Pokémon fainted: choose which one to send in.' : 'Choose your action for this turn.',
    field: nonZero({ weather: view.field.weather, terrain: view.field.terrain }),
    mine: {
      active: me.hp > 0 ? monFacts(me, { own: true, foe: foeActive }) : { fainted: monFacts(me, { own: true }).species },
      bench: (mine.team as VisibleFighterView[]).filter((_, i) => i !== mine.active).map((f) => (f.hp > 0 ? monFacts(f, { own: true, foe: foeActive }) : { species: f.speciesName, fainted: true })),
      ...(Object.keys(nonZero(mine.screens)).length ? { screens: nonZero(mine.screens) } : {}),
    },
    rival: {
      active: foeActive ? monFacts(foeActive, { own: false }) : null,
      others: theirs.team.filter((_, i) => i !== theirs.active).map((f) => (f.hidden ? { unknown: true } : f.hp > 0 ? monFacts(f, { own: false }) : { species: f.speciesName, fainted: true })),
      ...(Object.keys(nonZero(theirs.screens)).length ? { screens: nonZero(theirs.screens) } : {}),
    },
  };
}

export function jevOptions(battle: BattleState, sideIndex: number): { criteria: Record<string, Facts>; actions: Record<string, Action> } {
  const view = publicState(battle, sideIndex);
  const mine = view.sides[sideIndex];
  const theirs = view.sides[1 - sideIndex];
  const me = mine.team[mine.active] as VisibleFighterView;
  const foeRaw = theirs.team[theirs.active];
  const foe = isVisible(foeRaw) && foeRaw.hp > 0 ? foeRaw : null;
  const criteria: Record<string, Facts> = {};
  const actions: Record<string, Action> = {};
  for (const action of validActions(battle, sideIndex)) {
    if (action.type === 'move') {
      const key = action.move === STRUGGLE_MOVE ? 'struggle' : `move_${action.move}`;
      actions[key] = action;
      criteria[key] = action.move === STRUGGLE_MOVE
        ? { action: 'Struggle (no PP left in any move): weak attack that also hurts you' }
        : { action: `Use ${me.moves[action.move].name}`, ...moveFacts(me.moves[action.move], me, foe, me.pp[me.moves[action.move].key]) };
    } else {
      const view = mine.team[action.to] as VisibleFighterView;
      const key = `switch_${action.to}`;
      actions[key] = action;
      criteria[key] = {
        action: `Switch to ${view.speciesName}`,
        types: view.types,
        hpPercent: pct(view),
        ...(view.status ? { status: STATUS_NAME[view.status] ?? view.status } : {}),
        ...(foe ? { worstRivalTypeVsIt: `x${Math.max(...foe.types.map((t) => effectiveness(t, view.types)))}` } : {}),
        ...(foe
          ? { bestMoveVsRival: `x${Math.max(0, ...view.moves.filter((m) => m.kind !== 'status' && m.type).map((m) => effectiveness(m.type, foe.types)))}` }
          : {}),
      };
    }
  }
  return { criteria, actions };
}

export async function askJev({ url = JEV_DEFAULT_URL, model = JEV_DEFAULT_MODEL, apiKey, state, criteria, fetchImpl = fetch, timeoutMs = JEV_TIMEOUT_MS }: JevOptions & { state: Facts; criteria: Record<string, Facts> }): Promise<{ key: string; confidence: number | null }> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model,
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
  } catch (error) {
    throw new Error((error as Error | null)?.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body = (await res.json().catch(() => null)) as { answers?: { action?: { choice?: unknown; confidence?: number } } } | null;
  const answer = body?.answers?.action;
  if (!answer || typeof answer.choice !== 'string' || !Object.hasOwn(criteria, answer.choice)) throw new Error('bad answer');
  return { key: answer.choice, confidence: answer.confidence ?? null };
}

export async function chooseJevAction(
  battle: BattleState,
  sideIndex: number,
  { url, model, apiKey, fetchImpl, timeoutMs }: JevOptions = {},
): Promise<Action | null> {
  try {
    const { criteria, actions } = jevOptions(battle, sideIndex);
    const keys = Object.keys(criteria);
    if (!keys.length) return null;
    if (keys.length === 1) return actions[keys[0]];
    const { key } = await askJev({ url, model, apiKey, state: jevState(battle, sideIndex), criteria, fetchImpl, timeoutMs });
    return actions[key];
  } catch (error) {
    console.warn(`Skynet: Jev no respondió (${(error as Error).message}), decide la IA Muy difícil.`);
    return null;
  }
}

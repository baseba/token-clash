import type { BattleEvent, BattleState } from './battle-types.js';
import { needsAction } from './battle.js';
import { currentWeather } from './engine/effects.js';
import { fighterView, percentOf } from './engine/fighter-view.js';

function inPercent(event: Extract<BattleEvent, { hp: number }>) {
  const hp = percentOf(event.hp, event.max);
  const shown = { ...event, hp, max: 100, pct: true as const, ...('stats' in event ? { stats: { hp: 100 } } : {}) };
  if (!('amount' in event)) return shown;
  const before = event.t === 'heal' ? event.hp - event.amount : event.hp + event.amount;
  return { ...shown, amount: event.amount > 0 ? Math.max(1, Math.abs(percentOf(before, event.max) - hp)) : 0 };
}

function viewEvent(event: BattleEvent, viewer: number | null) {
  if (event.t === 'switch') {
    const { card, seen, ...rest } = event;
    return { ...rest, mon: event.side === viewer ? card : seen };
  }
  if (!('side' in event) || event.side === viewer) return event;
  if ('hp' in event) return inPercent(event);
  return 'stats' in event ? { ...event, stats: { hp: 100 } } : event;
}

export type EventView = ReturnType<typeof viewEvent>;

export function viewEvents(events: BattleEvent[], viewer: number | null = null): EventView[] {
  return events.map((e) => viewEvent(e, viewer));
}

export function publicState(battle: BattleState, viewer: number | null = null) {
  return {
    id: battle.id,
    status: battle.status,
    phase: battle.phase,
    turn: battle.turn,
    winner: battle.winner,
    field: {
      weather: battle.field.weather,
      terrain: battle.field.terrain,
      weatherSuppressed: !!battle.field.weather && !currentWeather(battle),
      rooms: { ...battle.field.rooms },
    },
    intro: battle.turn === 1 && battle.phase === 'choose' ? viewEvents(battle.intro, viewer) : [],
    sides: battle.sides.map((side, s) => ({
      trainerId: side.trainerId,
      name: side.name,
      avatar: side.avatar,
      frame: side.frame,
      ball: side.ball,
      active: side.active,
      ready: !needsAction(battle, s),
      mustSwitch: side.mustSwitch,
      toxicSpikes: side.toxicSpikes,
      screens: { ...side.screens },
      hazards: { ...side.hazards },
      conds: { ...side.conds },
      ...(side.wish ? { wish: true } : {}),
      ...(side.future ? { future: side.future.name } : {}),
      team: side.team.map((f, i) => fighterView(battle, s, i, viewer === s || battle.status === 'finished', viewer === null)),
    })),
  };
}

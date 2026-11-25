import { poisoned } from './conditions.js';
import type { BattleFighter, BattleState, SideCondition } from './battle-types.js';
import { computeDamage, typeEffectiveness } from './damage.js';
import { faint, settle } from './switching.js';
import { activeFighters, activeOf, boost, clearTerrain, clearWeather, currentWeather, emit, foeOf, grounded, heal, hurt, nameOf, onField, SCREEN_KINDS, setStatus, sideIndexOf, speedOf } from './effects.js';
import { abilityDef, chain, flag, run } from './ability-engine.js';

const SAND_PROOF = ['rock', 'ground', 'steel'];

function statusDamage(battle: BattleState, fighter: BattleFighter): void {
  if (fighter.status !== 'brn' && !poisoned(fighter.status)) return;
  let amount: number;
  if (fighter.status === 'brn') amount = fighter.stats.hp / (flag(battle, fighter, 'halvesBurn') ? 32 : 16);
  else if (fighter.status === 'psn') amount = fighter.stats.hp / 8;
  else {
    fighter.statusTurns = Math.min(15, fighter.statusTurns + 1);
    amount = (fighter.stats.hp * fighter.statusTurns) / 16;
  }
  amount = chain(battle, fighter, 'onStatusDamage', Math.max(1, Math.floor(amount)), fighter.status);
  if (amount > 0) hurt(battle, fighter, amount, fighter.status);
}

export function residual(battle: BattleState): void {
  const order = () => activeFighters(battle).sort((x, y) => speedOf(battle, y) - speedOf(battle, x));
  const weather = currentWeather(battle);
  for (const fighter of order()) {
    if (weather === 'sand' && !fighter.types.some((t) => SAND_PROOF.includes(t)) && !abilityDef(battle, fighter)?.weatherImmune?.includes('sand'))
      hurt(battle, fighter, fighter.stats.hp / 16, 'sand');
    if (weather === 'hail' && !fighter.types.includes('ice') && !abilityDef(battle, fighter)?.weatherImmune?.includes('hail'))
      hurt(battle, fighter, fighter.stats.hp / 16, 'hail');
    if (fighter.hp > 0 && battle.field.terrain === 'grassy' && grounded(battle, fighter)) heal(battle, fighter, fighter.stats.hp / 16);
    if (fighter.hp > 0) statusDamage(battle, fighter);
    if (fighter.hp > 0 && fighter.volatiles.leechSeed) {
      const seeder = foeOf(battle, fighter);
      const drained = hurt(battle, fighter, fighter.stats.hp / 8, 'leechseed');
      if (seeder && drained) {
        if (flag(battle, fighter, 'oozes')) hurt(battle, seeder, drained, 'ooze');
        else heal(battle, seeder, drained);
      }
    }
    if (fighter.hp > 0 && fighter.volatiles.bound) {
      const bound = fighter.volatiles.bound;
      if (!onField(battle, bound.by) || --bound.turns <= 0) {
        delete fighter.volatiles.bound;
        emit(battle, { t: 'volatileEnd', side: sideIndexOf(battle, fighter), name: nameOf(fighter), kind: 'bound', move: bound.move });
      } else hurt(battle, fighter, fighter.stats.hp / 8, 'bound');
    }
    if (fighter.hp > 0 && fighter.volatiles.saltCure)
      hurt(battle, fighter, fighter.stats.hp / (fighter.types.includes('water') || fighter.types.includes('steel') ? 4 : 8), 'saltcure');
    if (fighter.hp > 0 && fighter.volatiles.aquaRing) heal(battle, fighter, fighter.stats.hp / 16);
    if (fighter.hp > 0 && fighter.volatiles.ingrain) heal(battle, fighter, fighter.stats.hp / 16);
    if (fighter.hp > 0 && fighter.volatiles.curse) hurt(battle, fighter, fighter.stats.hp / 4, 'curse');
    if (fighter.hp > 0 && fighter.volatiles.nightmare) {
      if (fighter.status === 'slp') hurt(battle, fighter, fighter.stats.hp / 4, 'nightmare');
      else delete fighter.volatiles.nightmare;
    }
    if (fighter.hp > 0 && fighter.volatiles.octolock) {
      if (onField(battle, fighter.volatiles.octolock)) boost(battle, fighter, { def: -1, sdef: -1 }, fighter.volatiles.octolock);
      else delete fighter.volatiles.octolock;
    }
  }
  settle(battle);
  for (const fighter of order()) {
    if (fighter.volatiles.yawn && --fighter.volatiles.yawn <= 0) {
      delete fighter.volatiles.yawn;
      setStatus(battle, fighter, 'slp', null);
    }
    for (const [key, kind] of [['taunt', 'taunt'], ['encore', 'encore'], ['healBlock', 'healblock'], ['telekinesis', 'telekinesis'], ['magnetRise', 'magnetrise']] as const) {
      const effect = fighter.volatiles[key];
      if (!effect) continue;
      if (--effect.turns <= 0 || ('key' in effect && !(fighter.pp[effect.key] > 0))) {
        delete fighter.volatiles[key];
        emit(battle, { t: 'volatileEnd', side: sideIndexOf(battle, fighter), name: nameOf(fighter), kind });
      }
    }
  }
  battle.sides.forEach((side, sideIndex) => {
    const fighter = activeOf(battle, sideIndex);
    if (side.wish && side.wish.at <= battle.turn) {
      const wish = side.wish;
      delete side.wish;
      if (fighter.hp > 0) {
        emit(battle, { t: 'wish', side: sideIndex, name: wish.name });
        heal(battle, fighter, wish.amount);
      }
    }
    if (side.future && side.future.at <= battle.turn) {
      const future = side.future;
      delete side.future;
      if (fighter.hp > 0) {
        emit(battle, { t: 'futureHit', side: sideIndex, name: nameOf(fighter), move: future.name });
        const eff = typeEffectiveness(battle, future.move, future.user, fighter);
        if (eff === 0) emit(battle, { t: 'immune', side: sideIndex });
        else {
          const { dmg } = computeDamage(battle, future.user, fighter, future.move, eff, future.move.power);
          hurt(battle, fighter, dmg, 'future');
        }
      }
    }
    side.guards.clear();
    for (const [kind, turns] of Object.entries(side.conds) as [SideCondition, number][]) {
      if (turns > 1) side.conds[kind] = turns - 1;
      else {
        delete side.conds[kind];
        emit(battle, { t: 'sideEnd', side: sideIndex, kind });
      }
    }
  });
  settle(battle);
  for (const key of Object.keys(battle.field.rooms)) {
    if (--battle.field.rooms[key] <= 0) {
      delete battle.field.rooms[key];
      emit(battle, { t: 'fieldEnd', kind: key });
    }
  }
  for (const fighter of order()) run(battle, fighter, 'onEndTurn');
  settle(battle);
  for (const fighter of order()) {
    if (fighter.volatiles.perish) {
      fighter.volatiles.perish -= 1;
      emit(battle, { t: 'perish', side: sideIndexOf(battle, fighter), name: nameOf(fighter), count: fighter.volatiles.perish });
      if (!fighter.volatiles.perish) {
        fighter.hp = 0;
        faint(battle, fighter);
        continue;
      }
    }
    if (fighter.volatiles.disabled && --fighter.volatiles.disabled.turns <= 0) {
      emit(battle, {
        t: 'volatileEnd',
        side: sideIndexOf(battle, fighter),
        name: nameOf(fighter),
        kind: 'disable',
        move: fighter.volatiles.disabled.name,
      });
      delete fighter.volatiles.disabled;
    }
    delete fighter.volatiles.flinch;
  }
  battle.sides.forEach((side, sideIndex) => {
    for (const kind of SCREEN_KINDS) {
      if (!side.screens[kind] || --side.screens[kind] > 0) continue;
      delete side.screens[kind];
      emit(battle, { t: 'screenEnd', side: sideIndex, screen: kind, cause: 'time' });
    }
  });
  if (battle.field.weather && --battle.field.weatherTurns <= 0) clearWeather(battle);
  if (battle.field.terrain && --battle.field.terrainTurns <= 0) clearTerrain(battle);
}

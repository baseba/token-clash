// What each held item does in battle, written with the same hooks as the abilities (ability-effects.ts):
// the engine calls a fighter's ability first and then its item. Items never use the battle's random
// numbers unless one is held, so battles without items (the arena's) play exactly as before.
import { HELD_ITEMS, TYPE_BOOST } from '../../catalog/domain/held-items.js';
import { speciesData } from '../../catalog/domain/creatures.js';
import type { AbilityEffect } from './ability-effects.js';
import type { BattleFighter } from './battle-types.js';

const FOCUS_BAND_CHANCE = 0.1;
const LIFE_ORB = 1.3;
const LIFE_ORB_COST = 10;
const BAND = 1.1;
const EXPERT_BELT = 1.2;
const WIDE_LENS = 1.1;
const EVIOLITE = 1.5;
const LEFTOVERS = 16;
const SHELL_BELL = 8;
const SITRUS = 4;
const ROCKY_HELMET = 6;

const full = (me: BattleFighter): boolean => me.hp >= me.stats.hp;
const canEvolve = (me: BattleFighter): boolean => {
  const data = speciesData(me.speciesId);
  return data?.chainLen != null && data.stage != null && data.stage < data.chainLen - 1;
};
const damaging = (category: string): boolean => category !== 'status';

/** An item's rules: the same hooks an ability has. */
export type ItemEffect = Partial<AbilityEffect>;

const typeBooster = (type: string): ItemEffect => ({ onBasePower: (_engine, _me, move) => (move.type === type && damaging(move.category) ? TYPE_BOOST : 1) });

const RULES: Record<string, ItemEffect> = {
  'muscle-band': { onBasePower: (_engine, _me, move) => (move.category === 'physical' ? BAND : 1) },
  'wise-glasses': { onBasePower: (_engine, _me, move) => (move.category === 'special' ? BAND : 1) },
  'scope-lens': { onCritStage: (_engine, _me, _move, _target, stage) => stage + 1 },
  'wide-lens': { onAccuracy: (_engine, _me, _move, _target, acc) => acc * WIDE_LENS },
  'expert-belt': { onAttackerFinal: (_engine, _me, _move, _target, { eff }) => (eff > 1 ? EXPERT_BELT : 1) },
  'life-orb': {
    onBasePower: (_engine, _me, move) => (damaging(move.category) ? LIFE_ORB : 1),
    onAfterMoveHit(engine, me, _move, _target, total) {
      if (total <= 0 || me.hp <= 0) return;
      engine.showItem(me);
      engine.damage(me, me.stats.hp / LIFE_ORB_COST, 'item');
    },
  },
  leftovers: {
    onEndTurn(engine, me) {
      if (me.hp <= 0 || full(me)) return;
      engine.showItem(me);
      engine.heal(me, me.stats.hp / LEFTOVERS);
    },
  },
  'shell-bell': {
    onAfterMoveHit(engine, me, _move, _target, total) {
      if (total <= 0 || me.hp <= 0 || full(me)) return;
      engine.showItem(me);
      engine.heal(me, total / SHELL_BELL);
    },
  },
  'sitrus-berry': {
    onDamagingHit(engine, me) {
      if (me.hp <= 0 || me.hp > me.stats.hp / 2) return;
      engine.useUpItem(me);
      engine.heal(me, me.stats.hp / SITRUS);
    },
  },
  'lum-berry': {
    onAfterSetStatus(engine, me) {
      if (me.hp <= 0 || !me.status) return;
      engine.useUpItem(me);
      engine.cure(me, true);
    },
  },
  'focus-sash': {
    onDamage(engine, me, _move, _attacker, dmg) {
      if (!full(me) || dmg < me.hp || me.hp <= 1) return dmg;
      engine.useUpItem(me);
      return me.hp - 1;
    },
  },
  'focus-band': {
    onDamage(engine, me, _move, _attacker, dmg) {
      if (dmg < me.hp || me.hp <= 1 || engine.rand() >= FOCUS_BAND_CHANCE) return dmg;
      engine.showItem(me);
      return me.hp - 1;
    },
  },
  'rocky-helmet': {
    onDamagingHit(engine, me, move, attacker) {
      if (!move.flags.includes('contact') || attacker.hp <= 0) return;
      engine.showItem(me);
      engine.damage(attacker, attacker.stats.hp / ROCKY_HELMET, 'item');
    },
  },
  eviolite: { onDefense: (_engine, me) => (canEvolve(me) ? EVIOLITE : 1) },
};

export const ITEMS: Readonly<Record<string, ItemEffect>> = Object.fromEntries(
  Object.values(HELD_ITEMS).map((item) => [item.key, item.boosts ? typeBooster(item.boosts) : RULES[item.key] ?? {}]),
);

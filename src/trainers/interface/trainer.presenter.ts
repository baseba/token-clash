import { abilityInfo } from '../../catalog/domain/abilities.js';
import { abilityOptions, moveOrigins, natureFor, natureInfo, NATURE_KEYS, speciesData } from '../../catalog/domain/creatures.js';
import { buildFighter, movepool, movesetFor, MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import type { Trainer } from '../domain/trainer.js';
import { recycleReward } from '../domain/recycling.js';
import { SHOP_ITEMS } from '../../catalog/domain/shop.js';

export function trainerSummary(trainer: Trainer) {
  return {
    id: trainer.id,
    name: trainer.name,
    avatar: trainer.look,
    frame: trainer.equipped?.frame ?? null,
    wins: trainer.wins,
    losses: trainer.losses,
    rosterSize: trainer.roster.length,
    shinies: trainer.shinies,
    totalTokens: trainer.totalTokens,
  };
}

export function shopSummary(trainer: Trainer) {
  return { balance: trainer.balance, earned: trainer.earned, recycled: trainer.recycledTokens, spent: trainer.shopSpent ?? 0, total: trainer.totalTokens, updatedAt: trainer.updatedAt ?? null, owned: trainer.owned ?? [], equipped: { ball: trainer.ball, window: trainer.equipped?.window ?? null, frame: trainer.equipped?.frame ?? null } };
}

export function shopView(trainer: Trainer) {
  return { ...shopSummary(trainer), avatar: trainer.look, items: SHOP_ITEMS.map((item) => ({ ...item, owned: trainer.owns(item.id) })) };
}

const recycledMon = ({ id, finalID, rarity, shiny }: Pick<RosterEntry, 'id' | 'finalID' | 'rarity' | 'shiny'>) => ({ id, name: speciesData(finalID)?.name ?? `#${finalID}`, sprite: String(finalID), rarity, shiny });

export function recyclingView(trainer: Trainer) {
  return {
    ...shopSummary(trainer),
    duplicates: trainer.recyclable.map((duplicate) => ({ ...recycledMon(duplicate), level: duplicate.level, tokens: recycleReward(duplicate) })),
    history: [...(trainer.recycled ?? [])].reverse().map((record) => ({ ...recycledMon(record), tokens: record.tokens, at: record.at })),
  };
}

export function myView(trainer: Trainer, aiLevels: string[]) {
  return {
    ...trainerSummary(trainer),
    hasPassword: trainer.hasPassword,
    team: trainer.team,
    aiLevels,
    shop: shopSummary(trainer),
    roster: trainer.roster
      .map((e) => ({ ...buildFighter(e), active: !!e.active, nickname: e.nickname || null }))
      .sort((a, b) => a.speciesId - b.speciesId),
  };
}

export function monDetail(entry: RosterEntry) {
  const chosen = new Set(movesetFor(entry));
  const origins = moveOrigins(entry);
  return {
    ...buildFighter(entry),
    nickname: entry.nickname || null,
    movepool: movepool(entry).map((m) => ({
      ...origins.get(m.key),
      key: m.key,
      name: m.name,
      desc: m.desc,
      type: m.type,
      category: m.category,
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority,
      contact: m.flags.includes('contact'),
      supported: m.supported,
      chosen: chosen.has(m.key),
    })),
    abilityOptions: abilityOptions(entry).map((a) => ({ ...abilityInfo(a.key), hidden: a.hidden })),
    currentNature: natureInfo(natureFor(entry) ?? 'hardy'),
    savedNature: entry.nature ?? null,
    natureOptions: NATURE_KEYS.map(natureInfo),
    maxMoves: MOVES_PER_FIGHTER,
  };
}

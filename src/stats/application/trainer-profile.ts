import { isHumanDuel, type ChallengeState } from '../../arena/domain/challenge.js';
import { DEFAULT_BALL, shopItemOf, type ShopKind } from '../../catalog/domain/shop.js';
import type { Equipped } from '../../trainers/domain/trainer.js';
import { rankingOf, tournamentStats, type StatsSource } from './server-stats.js';

const RECENT = 10;
const FAVORITES = 6;

type ProfileTrainer = StatsSource['trainers'][string] & { look?: string; equipped?: Equipped; lastSeen?: number };
export type ProfileSource = StatsSource & { trainers: Record<string, ProfileTrainer> };

const itemOf = (kind: ShopKind, key: string | null | undefined) => {
  if (!key) return null;
  const item = shopItemOf(kind, key);
  return { key, name: item?.name ?? null, rarity: item?.rarity ?? null };
};

const sideOf = (challenge: ChallengeState, id: string) => (challenge.hostId === id ? 0 : challenge.guestId === id ? 1 : null);
const finishedAt = (challenge: ChallengeState) => challenge.finishedAt ?? challenge.createdAt;

function favoritesOf(battles: ChallengeState[], id: string) {
  const usage = new Map<string, { name: string; sprite?: string; types?: string[]; uses: number; wins: number }>();
  for (const challenge of battles) {
    const side = sideOf(challenge, id)!;
    for (const fighter of challenge.final!.sides[side]?.team ?? []) {
      if (!fighter.speciesName || fighter.hidden) continue;
      const row = usage.get(fighter.speciesName) ?? { name: fighter.speciesName, sprite: fighter.sprite, types: fighter.types, uses: 0, wins: 0 };
      row.uses += 1;
      if (challenge.final!.winner === side) row.wins += 1;
      usage.set(fighter.speciesName, row);
    }
  }
  return [...usage.values()].sort((a, b) => b.uses - a.uses || b.wins - a.wins || a.name.localeCompare(b.name)).slice(0, FAVORITES);
}

export function trainerDirectory(trainers: ProfileTrainer[]) {
  return trainers
    .map((trainer) => ({ id: trainer.id, name: trainer.name, avatar: trainer.look ?? null, frame: trainer.equipped?.frame ?? null, wins: trainer.wins, losses: trainer.losses }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

export function trainerProfile(source: ProfileSource, id: string) {
  const trainer = source.trainers[id];
  if (!trainer) return null;
  const challenges = Object.values(source.challenges);
  const battles = challenges
    .filter((challenge) => isHumanDuel(challenge) && challenge.status === 'finished' && challenge.final && sideOf(challenge, id) !== null)
    .sort((a, b) => finishedAt(b) - finishedAt(a));
  const vsAi = challenges.filter((challenge) => challenge.ai && !challenge.aiOnly && challenge.status === 'finished' && challenge.hostId === id);
  const place = rankingOf(Object.values(source.trainers)).findIndex((row) => row.id === id);
  const tournaments = tournamentStats(source).ranking.find((row) => row.id === id) ?? null;
  const games = trainer.wins + trainer.losses;
  return {
    id: trainer.id,
    name: trainer.name,
    avatar: trainer.look ?? null,
    lastSeen: trainer.lastSeen ?? null,
    record: { wins: trainer.wins, losses: trainer.losses, games, winRate: games ? trainer.wins / games : null, rank: place >= 0 ? place + 1 : null },
    collection: { pokemon: trainer.roster.length, species: new Set(trainer.roster.map((entry) => entry.finalID)).size, shinies: trainer.roster.filter((entry) => entry.shiny).length, tokens: trainer.totalTokens ?? 0 },
    vsAi: { wins: vsAi.filter((challenge) => challenge.winnerId === id).length, losses: vsAi.filter((challenge) => challenge.winnerId && challenge.winnerId !== id).length },
    tournaments: tournaments && { titles: tournaments.titles, finals: tournaments.finals, played: tournaments.played },
    using: {
      trainer: itemOf('trainer', trainer.look),
      ball: itemOf('ball', trainer.equipped?.ball ?? DEFAULT_BALL),
      window: itemOf('window', trainer.equipped?.window),
      frame: itemOf('frame', trainer.equipped?.frame),
    },
    favorites: favoritesOf(battles, id),
    recent: battles.slice(0, RECENT).map((challenge) => {
      const side = sideOf(challenge, id)!;
      const rivalId = side === 0 ? challenge.guestId : challenge.hostId;
      const rivalName = side === 0 ? challenge.guestName : challenge.hostName;
      return {
        id: challenge.id,
        rival: { id: rivalId ?? null, name: (rivalId && source.trainers[rivalId]?.name) || rivalName || '¿?' },
        result: !challenge.winnerId ? 'draw' : challenge.winnerId === id ? 'won' : 'lost',
        mode: challenge.mode,
        turns: challenge.turns ?? null,
        finishedAt: finishedAt(challenge),
      };
    }),
  };
}

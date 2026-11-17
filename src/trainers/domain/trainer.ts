// The Trainer aggregate: a player, their collection (roster) and the team they fight with.
// Every change to a trainer goes through these methods, which keep the rules in one place:
// a team never repeats a species, has at most 6, and always points at Pokémon in the roster.

import { abilityOptions, usableAbility, validMoveset, MOVES_PER_FIGHTER } from '../../catalog/domain/creatures.js';
import { uniqueSpecies, uniqueVariants, type RosterEntry } from '../../catalog/domain/roster-entry.js';
import { PARTY_SIZE } from '../../combat/domain/team-preview.js';
import { invalid, notFound } from '../../shared/domain/errors.js';
import { carryTeam, type ParsedSave } from './save-file.js';

export interface TrainerState {
  id: string;
  name: string;
  /** sha256 of the session token: the token itself is never stored. */
  tokenHash: string;
  roster: RosterEntry[];
  /** Roster entry ids, leader first. */
  team: string[];
  wins: number;
  losses: number;
  totalTokens: number;
  createdAt: number;
  updatedAt?: number;
  lastSeen?: number;
}

const RARITY_RANK = { legendary: 3, rare: 2, uncommon: 1, common: 0 } as const;

/** Strips control and bidi characters a name could use to break the UI, and caps its length. */
export function cleanName(s: string, max = 24): string {
  return s
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .trim()
    .slice(0, max);
}

/** The best 6 of a roster (level, then rarity, then shiny), one per species. */
export function defaultTeam(roster: RosterEntry[]): string[] {
  const best = [...roster].sort((a, b) => b.level - a.level || RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity] || (b.shiny ? 1 : 0) - (a.shiny ? 1 : 0));
  return uniqueSpecies(best)
    .slice(0, PARTY_SIZE)
    .map((e) => e.id);
}

export class Trainer implements TrainerState {
  id: string;
  name: string;
  tokenHash: string;
  roster: RosterEntry[];
  team: string[];
  wins: number;
  losses: number;
  totalTokens: number;
  createdAt: number;
  updatedAt?: number;
  lastSeen?: number;

  private constructor(state: TrainerState) {
    Object.assign(this, state);
  }

  /** Rebuilds a trainer that already exists (from the database). */
  static restore(state: TrainerState): Trainer {
    return new Trainer(state);
  }

  /** A new player: they get an id and a session token hash, and an empty roster until they import. */
  static register({ id, name, tokenHash, at }: { id: string; name: string; tokenHash: string; at: number }): Trainer {
    return new Trainer({ id, name, tokenHash, roster: [], team: [], wins: 0, losses: 0, totalTokens: 0, createdAt: at, lastSeen: at });
  }

  get shinies(): number {
    return this.roster.filter((e) => e.shiny).length;
  }

  entry(entryId: string): RosterEntry {
    const e = this.roster.find((x) => x.id === entryId);
    if (!e) throw notFound('Ese Pokémon no está en tu colección.');
    return e;
  }

  /** The Pokémon of the team, in order (or the default team if the saved one is empty). */
  teamEntries(): RosterEntry[] {
    const byId = new Map(this.roster.map((e) => [e.id, e]));
    const team = uniqueSpecies(this.team.map((id) => byId.get(id)).filter((e): e is RosterEntry => !!e));
    return team.length ? team : defaultTeam(this.roster).map((id) => byId.get(id)!);
  }

  /** Copies of the team, for a room or a tournament match (later edits don't change them). */
  teamSnapshot(): RosterEntry[] {
    return this.teamEntries().map((e) => ({ ...e }));
  }

  rename(name: string): void {
    const n = cleanName(name);
    if (n) this.name = n;
  }

  /**
   * Takes a newer save. The collection is replaced by the save's, but what the player chose here
   * (nicknames, movesets, abilities) is kept for the Pokémon that are still there, and so is the team.
   */
  importSave(parsed: ParsedSave, at: number): void {
    const previous = this.roster;
    const kept = new Map(previous.map((e) => [e.id, { nickname: e.nickname, moveset: e.moveset, abilityChoice: e.abilityChoice }]));
    this.roster = parsed.roster.map((e) => {
      const k = kept.get(e.id);
      if (!k) return e;
      return Object.fromEntries(Object.entries({ ...e, ...k }).filter(([, v]) => v !== undefined)) as unknown as RosterEntry;
    });
    this.team = carryTeam(this.team, previous, this.roster);
    if (!this.team.length) this.team = defaultTeam(this.roster);
    this.totalTokens = parsed.totalTokens;
    this.updatedAt = at;
  }

  /** Unknown ids and repeated species are skipped; an empty choice keeps the current team. */
  chooseTeam(ids: string[]): void {
    const byId = new Map(this.roster.map((e) => [e.id, e]));
    const picked = [...new Set(ids.filter((id) => byId.has(id)))].map((id) => byId.get(id)!);
    const team = uniqueSpecies(picked)
      .map((e) => e.id)
      .slice(0, PARTY_SIZE);
    if (team.length) this.team = team;
  }

  /** An empty nickname removes it. Unknown Pokémon are ignored. */
  setNickname(entryId: string, name: string): void {
    const e = this.roster.find((x) => x.id === entryId);
    if (!e) return;
    const n = cleanName(name, 16);
    if (n) e.nickname = n;
    else delete e.nickname;
  }

  chooseMoves(entryId: string, moves: string[]): void {
    const e = this.entry(entryId);
    if (!validMoveset(e, moves)) throw invalid(`Elige entre 1 y ${MOVES_PER_FIGHTER} movimientos distintos que conozca.`);
    e.moveset = [...moves];
  }

  chooseAbility(entryId: string, ability: string): void {
    const e = this.entry(entryId);
    if (!abilityOptions(e).some((a) => a.key === ability)) throw invalid('Esa habilidad no es de su especie.');
    if (!usableAbility(ability)) throw invalid('Esa habilidad no tiene efecto en Token Clash.');
    e.abilityChoice = ability;
  }

  touch(at: number): void {
    this.updatedAt = at;
  }

  recordWin(): void {
    this.wins += 1;
  }

  recordLoss(): void {
    this.losses += 1;
  }

  /**
   * Older versions kept repeated Pokémon of a species. Keeps the first of each species and
   * variant, and fixes the team to match. Returns whether anything changed.
   */
  dropRepeatedSpecies(): boolean {
    const roster = uniqueVariants(this.roster ?? []);
    const team = carryTeam(this.team ?? [], this.roster, roster);
    if (roster.length === this.roster.length && team.join() === (this.team ?? []).join()) return false;
    this.team = team;
    this.roster = roster;
    if (!this.team.length) this.team = defaultTeam(roster);
    return true;
  }
}

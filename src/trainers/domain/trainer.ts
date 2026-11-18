// The Trainer aggregate: a player, their collection (roster) and the team they fight with.
// Every change to a trainer goes through these methods, which keep the rules in one place:
// a team never repeats a species, has at most 6, and always points at Pokémon in the roster.

import { abilityOptions, usableAbility } from '../../catalog/domain/creatures.js';
import { validMoveset, MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import { uniqueSpecies, uniqueVariants, type RosterEntry } from '../../catalog/domain/roster-entry.js';
import { PARTY_SIZE } from '../../combat/domain/team-preview.js';
import { conflict, forbidden, invalid, notFound } from '../../shared/domain/errors.js';
import { isShopTrainer, isTrainerSprite, STARTER_SPRITES, trainerSpriteFor } from '../../catalog/domain/trainer-sprites.js';
import { DEFAULT_BALL, shopItem, shopItemOf, type ShopItem } from '../../catalog/domain/shop.js';
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
  avatar?: string;
  shopBaseline?: number;
  shopSpent?: number;
  owned?: string[];
  equipped?: Equipped;
}

export type EquipKind = 'ball' | 'window' | 'frame';
export type Equipped = Partial<Record<EquipKind, string>>;

const RARITY_RANK = { legendary: 3, rare: 2, uncommon: 1, common: 0 } as const;

/** Strips control and bidi characters a name could use to break the UI, and caps its length. */
export function cleanName(raw: string, max = 24): string {
  return raw
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
  avatar?: string;
  shopBaseline?: number;
  shopSpent?: number;
  owned?: string[];
  equipped?: Equipped;

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

  get look(): string {
    return this.avatar ?? trainerSpriteFor(this.id, STARTER_SPRITES);
  }

  /** @throws {DomainError} the sprite is not one of the trainer sprites, or is sold in the shop and not bought */
  chooseAvatar(key: string): void {
    if (!isTrainerSprite(key)) throw invalid('Ese entrenador no existe.');
    if (isShopTrainer(key) && !this.owns(`trainer:${key}`) && key !== this.avatar) throw forbidden('Ese entrenador se compra en la tienda.');
    this.avatar = key;
  }

  releaseShopLook(): boolean {
    if (!this.avatar || !isShopTrainer(this.avatar) || this.owns(`trainer:${this.avatar}`)) return false;
    this.avatar = trainerSpriteFor(`${this.id}:shop`, STARTER_SPRITES);
    return true;
  }

  get earned(): number {
    return Math.max(0, this.totalTokens - (this.shopBaseline ?? 0));
  }

  get balance(): number {
    return Math.max(0, this.earned - (this.shopSpent ?? 0));
  }

  owns(itemId: string): boolean {
    return (this.owned ?? []).includes(itemId);
  }

  get ball(): string {
    return this.equipped?.ball ?? DEFAULT_BALL;
  }

  /** @throws {DomainError} the item doesn't exist, is already owned, or the balance is short */
  buy(itemId: string): ShopItem {
    const item = shopItem(itemId);
    if (!item) throw notFound('Ese artículo no existe.');
    if (this.owns(itemId)) throw conflict('Ya lo tienes.');
    if (this.balance < item.price) throw conflict('No te alcanzan los tokens.');
    this.owned = [...(this.owned ?? []), itemId];
    this.shopSpent = (this.shopSpent ?? 0) + item.price;
    return item;
  }

  /** @throws {DomainError} the item doesn't exist or wasn't bought */
  equip(kind: EquipKind, key: string | null): void {
    if (key !== null) {
      const item = shopItemOf(kind, key);
      if (!item) throw notFound('Ese artículo no existe.');
      if (!this.owns(item.id)) throw forbidden('Primero cómpralo en la tienda.');
    }
    const { [kind]: _, ...rest } = this.equipped ?? {};
    this.equipped = key === null ? rest : { ...rest, [kind]: key };
  }

  get shinies(): number {
    return this.roster.filter((e) => e.shiny).length;
  }

  entry(entryId: string): RosterEntry {
    const entry = this.roster.find((x) => x.id === entryId);
    if (!entry) throw notFound('Ese Pokémon no está en tu colección.');
    return entry;
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
    const clean = cleanName(name);
    if (clean) this.name = clean;
  }

  /**
   * Takes a newer save. The collection is replaced by the save's, but what the player chose here
   * (nicknames, movesets, abilities) is kept for the Pokémon that are still there, and so is the team.
   */
  importSave(parsed: ParsedSave, at: number): void {
    const previous = this.roster;
    const kept = new Map(previous.map((e) => [e.id, { nickname: e.nickname, moveset: e.moveset, abilityChoice: e.abilityChoice }]));
    this.roster = parsed.roster.map((entry) => {
      const keptFields = kept.get(entry.id);
      if (!keptFields) return entry;
      return Object.fromEntries(Object.entries({ ...entry, ...keptFields }).filter(([, v]) => v !== undefined)) as unknown as RosterEntry;
    });
    this.team = carryTeam(this.team, previous, this.roster);
    if (!this.team.length) this.team = defaultTeam(this.roster);
    if (parsed.totalTokens < this.totalTokens) this.shopBaseline = (this.shopBaseline ?? 0) - (this.totalTokens - parsed.totalTokens);
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
    const entry = this.roster.find((x) => x.id === entryId);
    if (!entry) return;
    const clean = cleanName(name, 16);
    if (clean) entry.nickname = clean;
    else delete entry.nickname;
  }

  chooseMoves(entryId: string, moves: string[]): void {
    const entry = this.entry(entryId);
    if (!validMoveset(entry, moves)) throw invalid(`Elige entre 1 y ${MOVES_PER_FIGHTER} movimientos distintos que conozca.`);
    entry.moveset = [...moves];
  }

  chooseAbility(entryId: string, ability: string): void {
    const entry = this.entry(entryId);
    if (!abilityOptions(entry).some((a) => a.key === ability)) throw invalid('Esa habilidad no es de su especie.');
    if (!usableAbility(ability)) throw invalid('Esa habilidad no tiene efecto en Token Clash.');
    entry.abilityChoice = ability;
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

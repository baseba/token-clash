import { abilityOptions, NATURE_NAMES, usableAbility } from '../../catalog/domain/creatures.js';
import { MAX_EV, MAX_EV_TOTAL, validEvs } from '../../../public/stat-formula.js';
import { validMoveset, MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import { uniqueSpecies, uniqueVariants, type Ivs, type RosterEntry } from '../../catalog/domain/roster-entry.js';
import { PARTY_SIZE } from '../../combat/domain/team-preview.js';
import { conflict, forbidden, invalid, notFound } from '../../shared/domain/errors.js';
import { isShopTrainer, isTrainerSprite, STARTER_SPRITES, trainerSpriteFor } from '../../catalog/domain/trainer-sprites.js';
import { DEFAULT_BALL, isFreeItem, shopItem, shopItemOf, type ShopItem } from '../../catalog/domain/shop.js';
import { carryTeam, type ParsedSave } from './save-file.js';
import { recycledTokens, recycleReward, type Duplicate, type RecycledRecord } from './recycling.js';

export interface TrainerState {
  id: string;
  name: string;
  tokenHash: string;
  passwordHash?: string;
  sessions?: TrainerSession[];
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
  duplicates?: Duplicate[];
  recycled?: RecycledRecord[];
}

export interface TrainerSession {
  tokenHash: string;
  openedAt: number;
}

export const MAX_SESSIONS = 10;

export const SHOP_TRAINER_NOT_BOUGHT = 'Ese entrenador se compra en tu perfil.';

export const EQUIP_KINDS = ['ball', 'window', 'frame'] as const;
export type EquipKind = (typeof EQUIP_KINDS)[number];
export type Equipped = Partial<Record<EquipKind, string>>;

const RARITY_RANK = { legendary: 3, rare: 2, uncommon: 1, common: 0 } as const;

export function cleanName(raw: string, max = 24): string {
  return raw
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .trim()
    .slice(0, max);
}

export function nameKey(name: string): string {
  return cleanName(name).normalize('NFC').replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

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
  passwordHash?: string;
  sessions?: TrainerSession[];
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
  duplicates?: Duplicate[];
  recycled?: RecycledRecord[];

  private constructor(state: TrainerState) {
    Object.assign(this, state);
  }

  static restore(state: TrainerState): Trainer {
    return new Trainer(state);
  }

  static register({ id, name, tokenHash, passwordHash, at }: { id: string; name: string; tokenHash: string; passwordHash: string; at: number }): Trainer {
    return new Trainer({ id, name, tokenHash, passwordHash, roster: [], team: [], wins: 0, losses: 0, totalTokens: 0, createdAt: at, lastSeen: at });
  }

  get hasPassword(): boolean {
    return !!this.passwordHash;
  }

  get sessionHashes(): string[] {
    return [this.tokenHash, ...(this.sessions ?? []).map((session) => session.tokenHash)];
  }

  setPassword(passwordHash: string): void {
    this.passwordHash = passwordHash;
  }

  openSession(tokenHash: string, at: number): void {
    this.sessions = [...(this.sessions ?? []), { tokenHash, openedAt: at }].slice(-MAX_SESSIONS);
  }

  closeSession(tokenHash: string, replacementHash: string): void {
    if (!this.hasPassword) throw conflict('Agrega una contraseña antes de cerrar sesión: sin ella no podrías volver a entrar.');
    if (tokenHash === this.tokenHash) this.tokenHash = replacementHash;
    else this.sessions = (this.sessions ?? []).filter((session) => session.tokenHash !== tokenHash);
  }

  get look(): string {
    return this.avatar ?? trainerSpriteFor(this.id, STARTER_SPRITES);
  }

  chooseAvatar(key: string): void {
    if (!isTrainerSprite(key)) throw invalid('Ese entrenador no existe.');
    if (isShopTrainer(key) && !this.owns(`trainer:${key}`) && key !== this.avatar) throw forbidden(SHOP_TRAINER_NOT_BOUGHT);
    this.avatar = key;
  }

  releaseShopLook(): boolean {
    if (!this.avatar || !isShopTrainer(this.avatar) || this.owns(`trainer:${this.avatar}`)) return false;
    this.avatar = trainerSpriteFor(`${this.id}:shop`, STARTER_SPRITES);
    return true;
  }

  refundRetired(prices: Readonly<Record<string, number>>): number {
    const retired = (this.owned ?? []).filter((id) => id in prices);
    for (const kind of EQUIP_KINDS) if (this.equipped?.[kind] && `${kind}:${this.equipped[kind]}` in prices) this.equip(kind, null);
    if (!retired.length) return 0;
    const refund = retired.reduce((sum, id) => sum + prices[id], 0);
    this.owned = (this.owned ?? []).filter((id) => !retired.includes(id));
    this.shopSpent = Math.max(0, (this.shopSpent ?? 0) - refund);
    return refund;
  }

  renameTrainers(renames: Readonly<Record<string, string>>): boolean {
    const moved = (key: string) => renames[key] ?? key;
    const owned = [...new Set((this.owned ?? []).map((id) => (id.startsWith('trainer:') ? `trainer:${moved(id.slice('trainer:'.length))}` : id)))];
    const avatar = this.avatar && moved(this.avatar);
    const changed = owned.length !== (this.owned ?? []).length || owned.some((id, i) => id !== this.owned?.[i]) || avatar !== this.avatar;
    if (!changed) return false;
    if (this.owned) this.owned = owned;
    this.avatar = avatar;
    return true;
  }

  replaceLook(key: string | null): void {
    this.avatar = key ?? undefined;
  }

  get earned(): number {
    return Math.max(0, this.totalTokens - (this.shopBaseline ?? 0));
  }

  get recycledTokens(): number {
    return recycledTokens(this.recycled ?? []);
  }

  get balance(): number {
    return Math.max(0, this.earned + this.recycledTokens - (this.shopSpent ?? 0));
  }

  get recyclable(): Duplicate[] {
    const done = new Set((this.recycled ?? []).map((record) => record.id));
    return (this.duplicates ?? []).filter((duplicate) => !done.has(duplicate.id));
  }

  topUpRecycled(): number {
    let added = 0;
    this.recycled = (this.recycled ?? []).map((record) => {
      const owed = recycleReward(record);
      if (record.tokens >= owed) return record;
      added += owed - record.tokens;
      return { ...record, tokens: owed };
    });
    return added;
  }

  recycle(entryId: string, at: number): RecycledRecord {
    if ((this.recycled ?? []).some((record) => record.id === entryId)) throw conflict('Ese Pokémon ya pasó por la trituradora.');
    const duplicate = (this.duplicates ?? []).find((entry) => entry.id === entryId);
    if (!duplicate) throw notFound('Ese Pokémon no está entre tus repetidos.');
    const record: RecycledRecord = { id: duplicate.id, finalID: duplicate.finalID, rarity: duplicate.rarity, shiny: duplicate.shiny, tokens: recycleReward(duplicate), at };
    this.recycled = [...(this.recycled ?? []), record];
    return record;
  }

  owns(itemId: string): boolean {
    return isFreeItem(itemId) || (this.owned ?? []).includes(itemId);
  }

  get ball(): string {
    return this.equipped?.ball ?? DEFAULT_BALL;
  }

  buy(itemId: string): ShopItem {
    const item = shopItem(itemId);
    if (!item) throw notFound('Ese artículo no existe.');
    if (this.owns(itemId)) throw conflict('Ya lo tienes.');
    if (this.balance < item.price) throw conflict('No te alcanzan los tokens.');
    this.owned = [...(this.owned ?? []), itemId];
    this.shopSpent = (this.shopSpent ?? 0) + item.price;
    return item;
  }

  equip(kind: EquipKind, key: string | null): void {
    if (key !== null) {
      const item = shopItemOf(kind, key);
      if (!item) throw notFound('Ese artículo no existe.');
      if (!this.owns(item.id)) throw forbidden('Primero cómpralo en tu perfil.');
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

  teamEntries(): RosterEntry[] {
    const byId = new Map(this.roster.map((e) => [e.id, e]));
    const team = uniqueSpecies(this.team.map((id) => byId.get(id)).filter((e): e is RosterEntry => !!e));
    return team.length ? team : defaultTeam(this.roster).map((id) => byId.get(id)!);
  }

  teamSnapshot(): RosterEntry[] {
    return this.teamEntries().map((e) => ({ ...e }));
  }

  rename(name: string): void {
    const clean = cleanName(name);
    if (clean) this.name = clean;
  }

  importSave(parsed: ParsedSave, at: number): void {
    const previous = this.roster;
    const kept = new Map(previous.map((e) => [e.id, { nickname: e.nickname, moveset: e.moveset, abilityChoice: e.abilityChoice, natureChoice: e.natureChoice, evs: e.evs }]));
    this.duplicates = parsed.duplicates;
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

  chooseTeam(ids: string[]): void {
    const byId = new Map(this.roster.map((e) => [e.id, e]));
    const picked = [...new Set(ids.filter((id) => byId.has(id)))].map((id) => byId.get(id)!);
    const team = uniqueSpecies(picked)
      .map((e) => e.id)
      .slice(0, PARTY_SIZE);
    if (team.length) this.team = team;
  }

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

  chooseNature(entryId: string, nature: string): void {
    const entry = this.entry(entryId);
    if (!NATURE_NAMES.has(nature)) throw invalid('Esa naturaleza no existe.');
    entry.natureChoice = nature;
  }

  chooseEvs(entryId: string, evs: Ivs): void {
    const entry = this.entry(entryId);
    if (!validEvs(evs)) throw invalid(`Cada EV va de 0 a ${MAX_EV} y entre todos suman como mucho ${MAX_EV_TOTAL}.`);
    entry.evs = { ...evs };
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

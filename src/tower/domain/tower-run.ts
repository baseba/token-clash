// The TowerRun aggregate: one climb of the Tower. Its status only moves these ways, and each method
// refuses any other:
//
//   drafting → climbing    draft      you take your first Pokémon from the professor's offers
//   climbing → climbing    chooseRoom on a plain floor, the way you take (a route, a tough one…)
//   climbing → resting     chooseRoom a room with no battle: a rest stop, a den or a dark deal (no experience)
//   climbing → resting     win        a floor cleared: experience, levels, evolutions and a rest
//   resting  → climbing    moveOn     you go up (after taking your rewards and maybe a recruit)
//   climbing → cleared     win        the last floor of a climb with an end
//   climbing → lost        lose       a battle lost (or drawn) ends the climb
//   any open → abandoned   abandon    you give it up
//
// While climbing or resting the party can be changed between battles, like in PokeRogue: the moves
// each Pokémon knows (by level, machine or tutor), the abilities it unlocked, its nature and its EVs.
// The party are copies of collection entries plus what the climb changed; the climb never writes back
// to the collection.
import { abilityFor, abilityOptions, hash, rng, type Random } from '../../catalog/domain/creatures.js';
import type { Ivs, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { MAX_LEVEL, PARTY_LIMIT, RECRUIT_LINE, ROOMS, START_LEVEL, STARTERS, TWIST_KEYS, type RoomKind, type TwistKey } from '../../catalog/domain/tower-cast.js';
import type { AiLevel } from '../../combat/domain/ai.js';
import { MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import { conflict, invalid } from '../../shared/domain/errors.js';
import { DETOURS, fitToParty, floorAt, isBoss, isLastFloor, levelCap, roomsAt, type Floor, type Rolls } from './floors.js';
import { foePicks, foeTeam } from './foe-team.js';
import { BATTLE_SIZE } from '../../combat/domain/battle.js';
import { evolutionPath, expForLevel, expYield, formAtLevel, levelForExp, levelMovesUpTo, movesAtLevel } from './growth.js';
import { labOffers, lineOf, natureOf, offerMoves, recruitOffers, type Offer } from './lab.js';
import { floorScore, totalPoints, type FloorScore } from './score.js';
import { cordEvolution, isNature, lockedAbilities, MOVE_REWARDS, PARTY_REWARDS, restRewards, STAT_REWARDS, stoneEvolution, trainingAfter, TWIST_REWARDS, type RestContext, type Reward } from './rewards.js';

export type RunStatus = 'drafting' | 'climbing' | 'resting' | 'lost' | 'cleared' | 'abandoned';
export const OPEN_STATUSES: readonly RunStatus[] = ['drafting', 'climbing', 'resting'];

export interface TowerMon {
  uid: string;
  entry: RosterEntry;
  speciesId: number;
  level: number;
  exp: number;
  /** The 4 (or fewer) it takes to battle. */
  moves: string[];
  /** Every move it can swap in: learned by level so far, or taught by a machine or a tutor. */
  known: string[];
  ability: string | null;
  /** Abilities a capsule let it use, besides the one it came with. */
  abilities: string[];
  nature: string | null;
  evs: Ivs;
  /** The level at which you stopped its evolution: it keeps its form until it levels up again. */
  heldAt?: number | null;
  /** The item it holds in battle (a reward). Battles never use it up for good: a berry is back in the next one. */
  item?: string | null;
}

export interface Growth {
  uid: string;
  fromLevel: number;
  toLevel: number;
  fromSpecies: number;
  toSpecies: number;
  learned: string[];
}

export interface FloorResult {
  floor: number;
  room?: RoomKind | null;
  won: boolean;
  growth: Growth[];
}

export interface RewardChoice {
  uid: string;
  replace?: string | null;
  ability?: string | null;
  nature?: string | null;
}

export interface TowerRunState {
  id: string;
  trainerId: string;
  difficulty: AiLevel;
  length: number | null;
  seed: string;
  status: RunStatus;
  floor: number;
  party: TowerMon[];
  offers: Offer[];
  rewards: Reward[];
  /** The way taken on the current floor, once chosen (only plain floors offer a choice). */
  room: RoomKind | null;
  /** How many of the rewards on offer you still take. */
  picks: number;
  rerolls: number;
  /** The draw of each floor reached, made when you got there: its ways and route rivals were unknown before. */
  rolls: Rolls;
  /** The points of every floor won. */
  log: FloorScore[];
  /** The floor of the last detour taken (a hideout or a way with no battle): the next two plain floors offer none. */
  detourAt: number | null;
  /** The rumour of this climb: what makes it play differently (null in climbs started before rumours). */
  twist: TwistKey | null;
  challengeId: string | null;
  lastResult: FloorResult | null;
  cleared: number;
  createdAt: number;
  updatedAt: number;
  finishedAt: number | null;
}

function monFrom(offer: Offer): TowerMon {
  const known = levelMovesUpTo(offer.speciesId, offer.level);
  const ability = abilityFor({ ...offer.entry, finalID: offer.speciesId });
  return {
    uid: offer.entry.id,
    entry: offer.entry,
    speciesId: offer.speciesId,
    level: offer.level,
    exp: expForLevel(offer.level),
    moves: offerMoves(offer),
    known: [...new Set([...known, ...movesAtLevel(offer.speciesId, offer.level)])],
    ability,
    abilities: ability ? [ability] : [],
    nature: natureOf(offer.entry),
    evs: { ...NO_EVS },
  };
}

const NO_EVS: Ivs = { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 };
export const REROLLS_PER_REST = 1;
/** Extra experience for each level a Pokémon is below the next floor's cap. */
const CATCH_UP_PER_LEVEL = 0.35;
const DEAL_PICKS = 2;
const REST_PICKS = 2;
const BOSS_PICKS = 2;

export class TowerRun implements TowerRunState {
  id!: string;
  trainerId!: string;
  difficulty!: AiLevel;
  length!: number | null;
  seed!: string;
  status!: RunStatus;
  floor!: number;
  party!: TowerMon[];
  offers!: Offer[];
  rewards!: Reward[];
  room!: RoomKind | null;
  picks!: number;
  rerolls!: number;
  rolls!: Rolls;
  log!: FloorScore[];
  detourAt!: number | null;
  twist!: TwistKey | null;
  challengeId!: string | null;
  lastResult!: FloorResult | null;
  cleared!: number;
  createdAt!: number;
  updatedAt!: number;
  finishedAt!: number | null;

  private constructor(state: TowerRunState) {
    Object.assign(this, state);
  }

  static restore(state: TowerRunState): TowerRun {
    return new TowerRun(state);
  }

  static start(input: { id: string; trainerId: string; difficulty: AiLevel; length: number | null; roster: readonly RosterEntry[]; at: number; random?: Random }): TowerRun {
    if (!input.roster.length) throw invalid('Necesitas Pokémon en tu colección para subir a la torre.');
    const seed = input.id;
    return new TowerRun({
      id: input.id,
      trainerId: input.trainerId,
      difficulty: input.difficulty,
      length: input.length,
      seed,
      status: 'drafting',
      floor: 1,
      party: [],
      offers: labOffers(input.roster, START_LEVEL, input.random ?? rng(`${seed}:lab`)),
      rewards: [],
      room: null,
      picks: 0,
      rerolls: 0,
      rolls: {},
      log: [],
      detourAt: null,
      twist: TWIST_KEYS[hash(`${seed}:twist`) % TWIST_KEYS.length],
      challengeId: null,
      lastResult: null,
      cleared: 0,
      createdAt: input.at,
      updatedAt: input.at,
      finishedAt: null,
    });
  }

  get points(): number {
    return totalPoints(this.log);
  }

  get open(): boolean {
    return OPEN_STATUSES.includes(this.status);
  }

  get starters(): number {
    return Math.min(STARTERS, this.offers.length);
  }

  draft(offerIds: readonly string[], at: number): void {
    if (this.status !== 'drafting') throw conflict('Ya elegiste a tu equipo.');
    const picked = offerIds.map((id) => this.offers.find((offer) => offer.id === id));
    if (picked.length !== this.starters || new Set(offerIds).size !== offerIds.length || picked.some((offer) => !offer))
      throw invalid(`Elige ${this.starters} Pokémon de las ofertas.`);
    this.party = (picked as Offer[]).map(monFrom);
    this.offers = [];
    this.status = 'climbing';
    this.rollFloor(at);
    this.updatedAt = at;
  }

  /** The draw of the floor you just reached. */
  private rollFloor(at: number): void {
    this.rolls = { ...this.rolls, [this.floor]: hash(`${this.seed}:${this.floor}:${at}`).toString(36) };
  }

  floorAt(number: number, room: RoomKind | null = null): Floor {
    const floor = floorAt(number, this.length, this.difficulty, this.seed, room, this.rolls, this.twist);
    return number === this.floor ? fitToParty(floor, this.party.map((mon) => mon.level)) : floor;
  }

  currentFloor(): Floor {
    return this.floorAt(this.floor, this.room);
  }

  /** The ways the current floor offers; empty on a boss floor or once one is taken. */
  rooms(): RoomKind[] {
    return this.status === 'climbing' && !this.room ? roomsAt(this.floor, this.length, this.seed, this.rolls, this.twist, this.detourAt) : [];
  }

  /** The floor each way leads to, to show who waits there before choosing. */
  roomFloors(): Floor[] {
    return this.rooms().map((room) => this.floorAt(this.floor, room));
  }

  get mustChooseRoom(): boolean {
    return this.rooms().length > 0;
  }

  /**
   * Takes one of the ways of a plain floor. One with no battle is resolved here and the floor is passed,
   * with no experience: only a battle raises levels, besides the rewards you choose.
   */
  chooseRoom(room: RoomKind, { at, roster, releaseUid = null }: { at: number; roster: readonly RosterEntry[]; releaseUid?: string | null }): void {
    if (!this.rooms().includes(room)) throw invalid('Ese camino no está en este piso.');
    if (room === 'deal' && (this.party.length <= 1 || !this.party.some((mon) => mon.uid === releaseUid))) throw invalid('El pacto pide a uno de tu equipo, y no puedes quedarte sin Pokémon.');
    this.room = room;
    this.updatedAt = at;
    if (DETOURS.includes(room)) this.detourAt = this.floor;
    if (ROOMS[room].battle) return;
    if (room === 'deal') this.party.splice(this.party.indexOf(this.member(releaseUid as string)), 1);
    const floor = this.currentFloor();
    const random = rng(`${this.seed}:room:${floor.number}`);
    this.lastResult = { floor: floor.number, room, won: true, growth: [] };
    this.cleared = floor.number;
    this.floor += 1;
    this.room = null;
    this.status = 'resting';
    this.rerolls = REROLLS_PER_REST;
    if (room === 'den') {
      this.rewards = [];
      this.picks = 0;
      this.offers = this.recruits(floor, roster, random);
      return;
    }
    this.picks = room === 'deal' ? DEAL_PICKS : REST_PICKS;
    this.rewards = restRewards(this.rewardTargets(), this.restContext(floor, { count: 4, minTier: room === 'deal' ? 'epic' : 'rare' }), random);
    this.offers = [];
  }

  foeTeam(): RosterEntry[] {
    return this.foeTeamAt(this.currentFloor());
  }

  /** The team a rival of this floor brings against your party as it is now (to show a way before taking it, too). */
  foeTeamAt(floor: Floor): RosterEntry[] {
    const party = this.party.map((mon) => ({ ivs: mon.entry.ivs, evs: mon.evs }));
    const met = this.log.filter((entry) => entry.floor < floor.number).flatMap((entry) => entry.lines ?? []);
    return foeTeam(floor, this.difficulty, rng(`${this.seed}:${this.rolls[floor.number] ?? ''}:foe:${floor.number}`), party, met);
  }

  /** Which of its team the rival of this floor takes to the battle against your party (indexes into `foeTeam()`). */
  foePicks(): number[] {
    const floor = this.currentFloor();
    const random = rng(`${this.seed}:${this.rolls[floor.number] ?? ''}:picks:${floor.number}:${this.log.length}`);
    return foePicks(floor, this.foeTeam(), this.difficulty, random, BATTLE_SIZE, this.party.map((mon) => mon.speciesId));
  }

  /** The party as the battle takes it: each one at its level, in its form, with its moves, ability and nature. */
  battleTeam(): RosterEntry[] {
    return this.party.map((mon) => ({
      ...mon.entry,
      finalID: mon.speciesId,
      level: mon.level,
      battleLevel: mon.level,
      battleIvs: mon.entry.ivs,
      moveset: mon.moves,
      ...(mon.ability ? { abilityChoice: mon.ability } : {}),
      ...(mon.nature ? { natureChoice: mon.nature } : {}),
      ...(mon.item ? { heldItem: mon.item } : {}),
      evs: mon.evs,
    }));
  }

  enterBattle(challengeId: string, at: number): void {
    if (this.status !== 'climbing') throw conflict('Ahora no hay nada que pelear.');
    if (this.mustChooseRoom) throw conflict('Primero elige tu camino en este piso.');
    this.challengeId = challengeId;
    this.updatedAt = at;
  }

  /** The battle of this floor ended. Returns false when it was not this climb's battle. */
  battleFinished(challengeId: string, won: boolean, { at, roster }: { at: number; roster: readonly RosterEntry[] }): boolean {
    if (this.status !== 'climbing' || this.challengeId !== challengeId) return false;
    this.challengeId = null;
    this.updatedAt = at;
    if (!won) {
      this.lastResult = { floor: this.floor, won: false, growth: [] };
      this.status = 'lost';
      this.finishedAt = at;
      return true;
    }
    const floor = this.currentFloor();
    this.log = [...this.log, floorScore(floor, this.foeTeam(), this.difficulty, this.twist)];
    this.lastResult = { floor: floor.number, room: floor.room, won: true, growth: this.gainExperience(floor) };
    this.cleared = floor.number;
    this.room = null;
    if (isLastFloor(floor.number, this.length)) {
      this.status = 'cleared';
      this.finishedAt = at;
      return true;
    }
    this.floor += 1;
    this.status = 'resting';
    this.rerolls = REROLLS_PER_REST;
    this.picks = isBoss(floor.kind) ? BOSS_PICKS : 1;
    const random = rng(`${this.seed}:rest:${floor.number}`);
    this.rewards = restRewards(this.rewardTargets(), this.restContext(floor), random);
    this.offers = isBoss(floor.kind) ? this.recruits(floor, roster, random) : [];
    return true;
  }

  /** What the party looks like to the rewards: who fits each one, and why. */
  rewardTargets() {
    return this.party.map((mon) => ({ uid: mon.uid, speciesId: mon.speciesId, finalId: mon.entry.finalID, level: mon.level, known: mon.known, abilities: mon.abilities, evs: mon.evs, ivs: mon.entry.ivs, nature: mon.nature, shiny: mon.entry.shiny, item: mon.item ?? null }));
  }

  private restContext(floor: Floor, overrides: Partial<RestContext> = {}): RestContext {
    const boss = isBoss(floor.kind);
    const minTier = floor.room === 'hideout' ? 'epic' : boss || floor.room === 'tough' ? 'rare' : 'common';
    return {
      floor: floor.number,
      boss,
      cap: levelCap(this.floor),
      minTier,
      ...(floor.room === 'calm' ? { maxTier: 'common' as const } : {}),
      recruitable: !boss,
      ...(this.twist ? TWIST_REWARDS[this.twist] ?? {} : {}),
      ...overrides,
    };
  }

  /** Another three offers in place of these, once per rest. */
  reroll(at: number): void {
    if (this.status !== 'resting' || !this.rewards.length) throw conflict('No hay premios que cambiar.');
    if (this.rerolls <= 0) throw conflict('Ya cambiaste los premios de esta parada.');
    this.rerolls -= 1;
    const previous = this.rewards;
    const floor = this.floorAt(this.floor - 1, this.lastResult?.room ?? null);
    const tiers = previous.map((reward) => reward.tier);
    const minTier = tiers.includes('epic') ? 'epic' : tiers.includes('rare') ? 'rare' : 'common';
    this.rewards = restRewards(this.rewardTargets(), this.restContext(floor, { minTier, count: previous.length, extra: 0, maxTier: minTier === 'common' ? 'common' : undefined }), rng(`${this.seed}:reroll:${this.floor}:${this.rerolls}`)).map((reward) => ({ ...reward, id: `${reward.id}:r${this.rerolls}` }));
    this.updatedAt = at;
  }

  /**
   * Experience up to the level cap of the next floor: the party never outgrows the rivals ahead. Like
   * Emerald Rogue's soft cap, the further below the cap a Pokémon is, the faster it catches up.
   */
  private gainExperience(floor: Floor): Growth[] {
    const foes = this.foeTeam();
    const nextCap = Math.min(MAX_LEVEL, levelCap(floor.number + 1));
    const cap = expForLevel(nextCap);
    return this.party.map((mon) => {
      const gained = foes.reduce((sum, foe) => sum + expYield({ speciesId: foe.finalID, level: foe.battleLevel ?? foe.level }, mon.level, isBoss(floor.kind)), 0);
      const catchUp = 1 + CATCH_UP_PER_LEVEL * Math.max(0, nextCap - mon.level);
      return this.grow(mon, Math.max(mon.exp, Math.min(cap, mon.exp + Math.round(gained * catchUp))));
    });
  }

  /** New level, maybe a new form, and the moves it learns on the way: into a free slot, or known. */
  private grow(mon: TowerMon, exp: number): Growth {
    const before = { level: mon.level, speciesId: mon.speciesId, known: [...mon.known] };
    mon.exp = exp;
    mon.level = levelForExp(exp);
    const path = evolutionPath(mon.entry.finalID);
    const natural = formAtLevel(mon.entry.finalID, mon.level);
    if (mon.heldAt != null && mon.level > mon.heldAt) mon.heldAt = null;
    const held = mon.heldAt != null;
    mon.speciesId = !held && path.indexOf(natural) >= path.indexOf(mon.speciesId) ? natural : mon.speciesId;
    this.settleForm(mon, before.speciesId);
    const learned = levelMovesUpTo(mon.speciesId, mon.level).filter((id) => !before.known.includes(id));
    mon.known.push(...learned);
    for (const id of learned) if (mon.moves.length < MOVES_PER_FIGHTER) mon.moves.push(id);
    return { uid: mon.uid, fromLevel: before.level, toLevel: mon.level, fromSpecies: before.speciesId, toSpecies: mon.speciesId, learned };
  }

  /** After an evolution, the abilities it unlocked that the new form has, and its own. */
  private settleForm(mon: TowerMon, fromSpecies: number): void {
    if (mon.speciesId === fromSpecies) return;
    const ability = abilityFor({ ...mon.entry, finalID: mon.speciesId, ...(mon.ability ? { abilityChoice: mon.ability } : {}) });
    const options = abilityOptions({ finalID: mon.speciesId }).map((option) => option.key);
    mon.abilities = [...new Set([...mon.abilities.filter((key) => options.includes(key)), ...(ability ? [ability] : [])])];
    mon.ability = ability;
  }

  private evolveNow(mon: TowerMon, next: number | null): Growth {
    if (!next) throw invalid('Ese Pokémon no puede evolucionar con esto ahora.');
    const before = { speciesId: mon.speciesId, known: [...mon.known] };
    mon.speciesId = next;
    this.settleForm(mon, before.speciesId);
    const learned = levelMovesUpTo(mon.speciesId, mon.level).filter((id) => !before.known.includes(id));
    mon.known.push(...learned);
    for (const id of learned) if (mon.moves.length < MOVES_PER_FIGHTER) mon.moves.push(id);
    return { uid: mon.uid, fromLevel: mon.level, toLevel: mon.level, fromSpecies: before.speciesId, toSpecies: mon.speciesId, learned };
  }

  private recruits(floor: Floor, roster: readonly RosterEntry[], random: Random, at: number | null = null): Offer[] {
    const level = at ?? Math.max(START_LEVEL, Math.round(this.party.reduce((sum, mon) => sum + mon.level, 0) / this.party.length) - 2);
    const guide = floor.foe ? { key: floor.foe.key, title: `${floor.foe.title} ${floor.foe.name}`, line: RECRUIT_LINE, type: floor.type } : { key: 'den', title: 'Madriguera', line: RECRUIT_LINE, type: null };
    return recruitOffers(roster, this.party.map((mon) => lineOf(mon.entry)), guide, level, random);
  }

  private member(uid: string): TowerMon {
    const mon = this.party.find((candidate) => candidate.uid === uid);
    if (!mon) throw invalid('Ese Pokémon no está en tu equipo.');
    return mon;
  }

  private assertEditable(): void {
    if (this.status !== 'climbing' && this.status !== 'resting') throw conflict('Ahora no puedes cambiar tu equipo.');
  }

  /** Uses a reward on a party member, or on the whole party. Returns what changed (levels or a new form). */
  takeReward(rewardId: string, choice: RewardChoice, { at, roster }: { at: number; roster: readonly RosterEntry[] }): Growth[] {
    if (this.status !== 'resting' || this.picks <= 0) throw conflict('No hay premios que tomar ahora.');
    const reward = this.rewards.find((candidate) => candidate.id === rewardId);
    if (!reward) throw invalid('Ese premio no existe.');
    if (!PARTY_REWARDS.includes(reward.kind) && !reward.fits.includes(choice.uid)) throw invalid('Ese Pokémon no puede usar este premio.');
    const growth = this.applyReward(reward, choice, roster);
    this.picks -= 1;
    this.rewards = this.picks > 0 ? this.rewards.filter((candidate) => candidate.id !== rewardId) : [];
    const changed = new Set(growth.map((entry) => entry.uid));
    this.lastResult = growth.length && this.lastResult ? { ...this.lastResult, growth: [...this.lastResult.growth.filter((entry) => !changed.has(entry.uid)), ...growth] } : this.lastResult;
    this.updatedAt = at;
    return growth;
  }

  private applyReward(reward: Reward, choice: RewardChoice, roster: readonly RosterEntry[]): Growth[] {
    const lastFloor = () => this.floorAt(this.floor - 1, this.lastResult?.room ?? null);
    const levelUp = (mon: TowerMon) => this.grow(mon, Math.max(mon.exp, expForLevel(Math.min(levelCap(this.floor), mon.level + (reward.levels ?? 1)))));
    switch (reward.kind) {
      case 'egg':
        this.offers = this.recruits(lastFloor(), roster, rng(`${this.seed}:egg:${this.floor}`));
        return [];
      case 'goldenEgg':
        this.offers = this.recruits(lastFloor(), roster, rng(`${this.seed}:egg:${this.floor}`), Math.max(...this.party.map((mon) => mon.level)));
        return [];
      case 'feather':
        for (const member of this.party) this.applyTraining(member, reward);
        return [];
      case 'expShare':
      case 'candyJar':
        return this.party.filter((member) => reward.fits.includes(member.uid)).map(levelUp);
    }
    const mon = this.member(choice.uid);
    if (MOVE_REWARDS.includes(reward.kind)) {
      this.teach(mon, reward.move as string, choice.replace ?? null);
      return [];
    }
    if (STAT_REWARDS.includes(reward.kind)) {
      this.applyTraining(mon, reward);
      return [];
    }
    switch (reward.kind) {
      case 'candy':
      case 'expCandy':
        return [levelUp(mon)];
      case 'capsule':
      case 'patch': {
        const options = lockedAbilities(mon, reward.kind === 'patch');
        if (!choice.ability || !options.includes(choice.ability)) throw invalid('Elige una habilidad que aún no tenga.');
        mon.abilities = [...new Set([...mon.abilities, choice.ability])];
        mon.ability = choice.ability;
        return [];
      }
      case 'stone':
        return [this.evolveNow(mon, stoneEvolution({ speciesId: mon.speciesId, finalId: mon.entry.finalID, level: mon.level }))];
      case 'linkingCord':
        return [this.evolveNow(mon, cordEvolution({ speciesId: mon.speciesId, finalId: mon.entry.finalID, level: mon.level }))];
      case 'mint':
        if (!choice.nature || !isNature(choice.nature)) throw invalid('Elige una naturaleza.');
        mon.nature = choice.nature;
        return [];
      case 'shinyCharm':
        mon.entry = { ...mon.entry, shiny: true };
        return [];
      case 'commonItem':
      case 'rareItem':
      case 'epicItem':
        mon.item = reward.item ?? mon.item ?? null;
        return [];
      default:
        return [];
    }
  }

  /** Its IVs, EVs and nature after a stat reward. */
  private applyTraining(mon: TowerMon, reward: Reward): void {
    const after = trainingAfter(reward, { uid: mon.uid, speciesId: mon.speciesId, ivs: mon.entry.ivs, evs: mon.evs, nature: mon.nature });
    if (!after) return;
    mon.entry = { ...mon.entry, ivs: after.ivs };
    mon.evs = after.evs;
    mon.nature = after.nature;
  }

  private teach(mon: TowerMon, move: string, replace: string | null): void {
    if (!mon.known.includes(move)) mon.known.push(move);
    if (mon.moves.includes(move)) return;
    if (mon.moves.length < MOVES_PER_FIGHTER) mon.moves.push(move);
    else if (replace && mon.moves.includes(replace)) mon.moves[mon.moves.indexOf(replace)] = move;
  }

  recruit(offerId: string, releaseUid: string | null, at: number): void {
    if (this.status !== 'resting' || !this.offers.length) throw conflict('No hay nadie que reclutar ahora.');
    const offer = this.offers.find((candidate) => candidate.id === offerId);
    if (!offer) throw invalid('Esa oferta no existe.');
    if (this.party.length >= PARTY_LIMIT) {
      const released = this.party.findIndex((mon) => mon.uid === releaseUid);
      if (released === -1) throw invalid('Tu equipo está lleno: elige a quién dejar ir.');
      this.party.splice(released, 1);
    }
    this.party.push(monFrom({ ...offer, level: Math.min(offer.level, levelCap(this.floor)) }));
    this.offers = [];
    this.updatedAt = at;
  }

  /** Lets a Pokémon go for good. The party never empties. */
  release(uid: string, at: number): void {
    this.assertEditable();
    if (this.party.length <= 1) throw invalid('Tu equipo no puede quedar vacío.');
    this.party.splice(this.party.indexOf(this.member(uid)), 1);
    this.updatedAt = at;
  }

  /** Changes the moves and ability of a Pokémon among the ones it has unlocked. */
  edit(uid: string, change: { moves?: string[]; ability?: string | null }, at: number): void {
    this.assertEditable();
    const mon = this.member(uid);
    if (change.moves) {
      const moves = [...new Set(change.moves)];
      if (!moves.length || moves.length > MOVES_PER_FIGHTER || moves.some((id) => !mon.known.includes(id))) throw invalid('Elige entre 1 y 4 movimientos que conozca.');
      mon.moves = moves;
    }
    if (change.ability) {
      if (!mon.abilities.includes(change.ability)) throw invalid('Esa habilidad no la tiene desbloqueada.');
      mon.ability = change.ability;
    }
    this.updatedAt = at;
  }

  /** "Detener": the evolution it just went through is undone until its next level. */
  holdEvolution(uid: string, at: number): void {
    if (this.status !== 'resting') throw conflict('Ahora no hay ninguna evolución que detener.');
    const growth = this.lastResult?.growth.find((entry) => entry.uid === uid);
    if (!growth || growth.toSpecies === growth.fromSpecies) throw invalid('Ese Pokémon no acaba de evolucionar.');
    const mon = this.member(uid);
    if (mon.speciesId !== growth.toSpecies) throw conflict('Su evolución ya cambió.');
    mon.speciesId = growth.fromSpecies;
    mon.heldAt = mon.level;
    this.settleForm(mon, growth.toSpecies);
    growth.toSpecies = growth.fromSpecies;
    this.updatedAt = at;
  }

  moveOn(at: number): void {
    if (this.status !== 'resting') throw conflict('Ya estás listo para subir.');
    this.rewards = [];
    this.offers = [];
    this.picks = 0;
    this.room = null;
    this.status = 'climbing';
    this.rollFloor(at);
    this.updatedAt = at;
  }

  abandon(at: number): void {
    if (!this.open) throw conflict('Esta subida ya terminó.');
    this.status = 'abandoned';
    this.challengeId = null;
    this.finishedAt = at;
    this.updatedAt = at;
  }
}

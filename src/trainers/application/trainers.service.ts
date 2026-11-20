// Use cases of the trainers context. This is the context's public face: other contexts (arena,
// stats, realtime) talk to trainers only through this service, never through its repository or
// its tables. TrainersModule exports this class and nothing else.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { newId, newToken, now, sha256 } from '../../shared/domain/clock.js';
import { conflict, forbidden, invalid } from '../../shared/domain/errors.js';
import { RARITIES } from '../../catalog/domain/shop.js';
import { RETIRED_RECOLORS, RETIRED_SHOP_TRAINERS } from '../../catalog/domain/trainer-sprites.js';
import { checkPassword, hashPassword, passwordMatches } from '../domain/credentials.js';
import { basicCredentials, bearerToken } from './auth-headers.js';
import type { RecycledRecord } from '../domain/recycling.js';
import { parseSave } from '../domain/save-file.js';
import { cleanName, nameKey, Trainer, type EquipKind } from '../domain/trainer.js';
import { TrainerRepository } from '../domain/trainer.repository.js';

const DECOY_PASSWORD_HASH = hashPassword(newToken());

export interface Credentials {
  name: string;
  password: string;
}

export interface ProfileChanges {
  name?: string;
  avatar?: string;
  team?: string[];
  nickname?: { id: string; name: string } | null;
}

@Injectable()
export class TrainersService implements OnModuleInit {
  private readonly logger = new Logger(TrainersService.name);

  constructor(private readonly trainers: TrainerRepository) {}

  onModuleInit(): void {
    // Saves imported by older versions kept repeated species: tidy them once at startup.
    let fixed = 0;
    let relooked = 0;
    let refunded = 0;
    const retiredPrices = Object.fromEntries(Object.entries({ ...RETIRED_SHOP_TRAINERS, ...RETIRED_RECOLORS }).map(([key, rarity]) => [key, RARITIES[rarity].price]));
    for (const trainer of this.trainers.all()) {
      const dropped = trainer.dropRepeatedSpecies();
      const released = trainer.releaseShopLook();
      const refund = trainer.refundRetired(retiredPrices);
      if (dropped || released || refund) this.trainers.save(trainer);
      if (dropped) fixed += 1;
      if (released) relooked += 1;
      if (refund) refunded += 1;
    }
    if (fixed) this.logger.log(`Quité especies repetidas de ${fixed} entrenador(es).`);
    if (refunded) this.logger.log(`Devolví los tokens de entrenadores que ya no se venden a ${refunded} entrenador(es).`);
    if (relooked) this.logger.log(`${relooked} entrenador(es) tenían un entrenador que ahora se vende en la tienda: les tocó otro.`);
  }

  byId(id: string | null | undefined): Trainer | undefined {
    return id ? this.trainers.findById(id) : undefined;
  }

  all(): Trainer[] {
    return this.trainers.all();
  }

  replaceLook(trainer: Trainer, key: string | null): void {
    trainer.replaceLook(key);
    this.trainers.save(trainer);
  }

  /** Who owns a session token, without marking them as seen (the lobby list does this). */
  peekToken(token: string | undefined): Trainer | undefined {
    return token === undefined ? undefined : this.trainers.findByTokenHash(sha256(token));
  }

  /** Who owns a session token, and mark them as seen now (feeds "active now" in the stats). */
  authenticate(token: string): Trainer | undefined {
    const trainer = this.peekToken(token);
    if (trainer) {
      trainer.lastSeen = now();
      this.trainers.saveLastSeen(trainer);
    }
    return trainer;
  }

  /** Same, from an `Authorization: Bearer <token>` header. */
  authenticateHeader(header: string | undefined): Trainer | undefined {
    const token = bearerToken(header);
    return token ? this.authenticate(token) : undefined;
  }

  /**
   * Imports a save. Without a session it registers a new trainer and returns their token (shown
   * once: only its hash is stored). With a session it updates that trainer's collection.
   */
  importSave(current: Trainer | undefined, input: { save: string; name?: string; password?: string }): { token: string | null; trainer: Trainer } {
    const parsed = parseSave(input.save);
    const name = cleanName(input.name ?? '');
    let trainer = current;
    let token: string | null = null;
    if (!trainer) {
      if (!name) throw invalid('Ponte un nombre de entrenador.');
      this.ensureNameFree(name);
      checkPassword(input.password ?? '');
      token = newToken();
      trainer = Trainer.register({ id: newId(), name, tokenHash: sha256(token), passwordHash: hashPassword(input.password ?? ''), at: now() });
    } else if (name) this.rename(trainer, name);
    trainer.importSave(parsed, now());
    this.trainers.save(trainer);
    return { token, trainer };
  }

  private verify(credentials: Credentials): Trainer | undefined {
    const key = nameKey(credentials.name);
    const trainer = this.trainers.all().find((candidate) => candidate.hasPassword && nameKey(candidate.name) === key);
    const matches = passwordMatches(credentials.password, trainer?.passwordHash ?? DECOY_PASSWORD_HASH);
    return trainer && matches ? trainer : undefined;
  }

  logIn(credentials: Credentials): { token: string; trainer: Trainer } | undefined {
    const trainer = this.verify(credentials);
    if (!trainer) return undefined;
    const token = newToken();
    trainer.openSession(sha256(token), now());
    this.trainers.save(trainer);
    return { token, trainer };
  }

  /** @throws {DomainError} the save is not a PokeTokenBar save */
  syncSave(authorization: string | undefined, save: string): Trainer | undefined {
    const credentials = basicCredentials(authorization);
    const trainer = credentials && this.verify(credentials);
    if (!trainer) return undefined;
    return this.importSave(trainer, { save }).trainer;
  }

  /** @throws {DomainError} the session can't be closed because the account has no password */
  logOut(trainer: Trainer, token: string): void {
    trainer.closeSession(sha256(token), sha256(newToken()));
    this.trainers.save(trainer);
  }

  /** @throws {DomainError} another trainer has the same name, the password is too short, or the current password is wrong */
  setPassword(trainer: Trainer, input: { password: string; currentPassword?: string }): Trainer {
    if (trainer.passwordHash && !passwordMatches(input.currentPassword ?? '', trainer.passwordHash)) throw forbidden('Tu contraseña actual no coincide.');
    if (this.namesake(trainer.name, trainer)) throw conflict(`Otro entrenador también se llama ${trainer.name}: cámbiate el nombre antes de agregar una contraseña, porque con él entras.`);
    checkPassword(input.password);
    trainer.setPassword(hashPassword(input.password));
    this.trainers.save(trainer);
    return trainer;
  }

  private namesake(name: string, owner?: Trainer): Trainer | undefined {
    const key = nameKey(name);
    return this.trainers.all().find((other) => other !== owner && nameKey(other.name) === key);
  }

  /** @throws {DomainError} another trainer already has that name */
  private ensureNameFree(name: string, owner?: Trainer): void {
    if (this.namesake(name, owner)) throw conflict(`Ya hay un entrenador que se llama ${cleanName(name)}, elige otro nombre.`);
  }

  /** @throws {DomainError} another trainer already has that name */
  private rename(trainer: Trainer, name: string): void {
    if (cleanName(name)) this.ensureNameFree(name, trainer);
    trainer.rename(name);
  }

  /** @throws {DomainError} the chosen look is not a trainer sprite, or another trainer already has the new name */
  updateProfile(trainer: Trainer, changes: ProfileChanges): Trainer {
    if (changes.name !== undefined) this.rename(trainer, changes.name);
    if (changes.avatar !== undefined) trainer.chooseAvatar(changes.avatar);
    if (changes.team) trainer.chooseTeam(changes.team);
    if (changes.nickname) trainer.setNickname(changes.nickname.id, changes.nickname.name);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  /** @throws {DomainError} the item doesn't exist, is already owned, or the balance is short */
  buy(trainer: Trainer, itemId: string): Trainer {
    trainer.buy(itemId);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  /** @throws {DomainError} the Pokémon is not a repeated one, or it was already recycled */
  recycle(trainer: Trainer, entryId: string): RecycledRecord {
    const record = trainer.recycle(entryId, now());
    trainer.touch(now());
    this.trainers.save(trainer);
    return record;
  }

  /** @throws {DomainError} the item doesn't exist or wasn't bought */
  equip(trainer: Trainer, kind: EquipKind, key: string | null): Trainer {
    trainer.equip(kind, key);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  updateMon(trainer: Trainer, entryId: string, changes: { moves?: string[]; ability?: string }): Trainer {
    trainer.entry(entryId); // 404 before anything else
    if (changes.moves !== undefined) trainer.chooseMoves(entryId, changes.moves);
    if (changes.ability !== undefined) trainer.chooseAbility(entryId, changes.ability);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  /** A ranked 1v1 ended. The arena decides whether a match is ranked; trainers keep the score. */
  recordRankedResult(winnerId: string, loserId: string): void {
    const winner = this.trainers.findById(winnerId);
    const loser = this.trainers.findById(loserId);
    if (winner) {
      winner.recordWin();
      this.trainers.save(winner);
    }
    if (loser) {
      loser.recordLoss();
      this.trainers.save(loser);
    }
  }
}

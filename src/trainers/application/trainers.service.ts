import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { newId, newToken, now, sha256 } from '../../shared/domain/clock.js';
import { conflict, forbidden, invalid } from '../../shared/domain/errors.js';
import { RARITIES, RETIRED_BALLS } from '../../catalog/domain/shop.js';
import { RENAMED_TRAINERS, RETIRED_RECOLORS, RETIRED_SHOP_TRAINERS } from '../../catalog/domain/trainer-sprites.js';
import { checkPassword, hashPassword, passwordMatches } from '../domain/credentials.js';
import { basicCredentials, bearerToken } from './auth-headers.js';
import type { RecycledRecord } from '../domain/recycling.js';
import type { Ivs } from '../../catalog/domain/roster-entry.js';
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
    let fixed = 0;
    let relooked = 0;
    let refunded = 0;
    let moved = 0;
    let recycledUp = 0;
    const retiredPrices = {
      ...Object.fromEntries(Object.entries({ ...RETIRED_SHOP_TRAINERS, ...RETIRED_RECOLORS }).map(([key, rarity]) => [`trainer:${key}`, RARITIES[rarity].price])),
      ...Object.fromEntries(Object.entries(RETIRED_BALLS).map(([key, rarity]) => [`ball:${key}`, RARITIES[rarity].price])),
    };
    for (const trainer of this.trainers.all()) {
      const renamed = trainer.renameTrainers(RENAMED_TRAINERS);
      const dropped = trainer.dropRepeatedSpecies();
      const released = trainer.releaseShopLook();
      const refund = trainer.refundRetired(retiredPrices);
      const toppedUp = trainer.topUpRecycled();
      if (renamed || dropped || released || refund || toppedUp) this.trainers.save(trainer);
      if (toppedUp) recycledUp += 1;
      if (renamed) moved += 1;
      if (dropped) fixed += 1;
      if (released) relooked += 1;
      if (refund) refunded += 1;
    }
    if (moved) this.logger.log(`Pasé ${moved} entrenador(es) a los nombres nuevos de sus recolores.`);
    if (fixed) this.logger.log(`Quité especies repetidas de ${fixed} entrenador(es).`);
    if (refunded) this.logger.log(`Devolví los tokens de lo que ya no se vende en la tienda a ${refunded} entrenador(es).`);
    if (recycledUp) this.logger.log(`Completé lo que faltaba del reciclaje a la tarifa nueva a ${recycledUp} entrenador(es).`);
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

  peekToken(token: string | undefined): Trainer | undefined {
    return token === undefined ? undefined : this.trainers.findByTokenHash(sha256(token));
  }

  authenticate(token: string): Trainer | undefined {
    const trainer = this.peekToken(token);
    if (trainer) {
      trainer.lastSeen = now();
      this.trainers.saveLastSeen(trainer);
    }
    return trainer;
  }

  authenticateHeader(header: string | undefined): Trainer | undefined {
    const token = bearerToken(header);
    return token ? this.authenticate(token) : undefined;
  }

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

  syncSave(authorization: string | undefined, save: string): Trainer | undefined {
    const credentials = basicCredentials(authorization);
    const trainer = credentials && this.verify(credentials);
    if (!trainer) return undefined;
    return this.importSave(trainer, { save }).trainer;
  }

  logOut(trainer: Trainer, token: string): void {
    trainer.closeSession(sha256(token), sha256(newToken()));
    this.trainers.save(trainer);
  }

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

  private ensureNameFree(name: string, owner?: Trainer): void {
    if (this.namesake(name, owner)) throw conflict(`Ya hay un entrenador que se llama ${cleanName(name)}, elige otro nombre.`);
  }

  private rename(trainer: Trainer, name: string): void {
    if (cleanName(name)) this.ensureNameFree(name, trainer);
    trainer.rename(name);
  }

  updateProfile(trainer: Trainer, changes: ProfileChanges): Trainer {
    if (changes.name !== undefined) this.rename(trainer, changes.name);
    if (changes.avatar !== undefined) trainer.chooseAvatar(changes.avatar);
    if (changes.team) trainer.chooseTeam(changes.team);
    if (changes.nickname) trainer.setNickname(changes.nickname.id, changes.nickname.name);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  buy(trainer: Trainer, itemId: string): Trainer {
    trainer.buy(itemId);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  recycle(trainer: Trainer, entryId: string): RecycledRecord {
    const record = trainer.recycle(entryId, now());
    trainer.touch(now());
    this.trainers.save(trainer);
    return record;
  }

  equip(trainer: Trainer, kind: EquipKind, key: string | null): Trainer {
    trainer.equip(kind, key);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

  updateMon(trainer: Trainer, entryId: string, changes: { moves?: string[]; ability?: string; nature?: string; evs?: Ivs }): Trainer {
    trainer.entry(entryId);
    if (changes.moves !== undefined) trainer.chooseMoves(entryId, changes.moves);
    if (changes.ability !== undefined) trainer.chooseAbility(entryId, changes.ability);
    if (changes.nature !== undefined) trainer.chooseNature(entryId, changes.nature);
    if (changes.evs !== undefined) trainer.chooseEvs(entryId, changes.evs);
    trainer.touch(now());
    this.trainers.save(trainer);
    return trainer;
  }

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

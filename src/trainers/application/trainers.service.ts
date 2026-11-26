import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { now } from '../../shared/domain/clock.js';
import { invalid } from '../../shared/domain/errors.js';
import { RARITIES, RETIRED_BALLS } from '../../catalog/domain/shop.js';
import { RENAMED_TRAINERS, RETIRED_RECOLORS, RETIRED_SHOP_TRAINERS } from '../../catalog/domain/trainer-sprites.js';
import { AccountsService } from './accounts.service.js';
import { basicCredentials } from './auth-headers.js';
import type { Ivs } from '../../catalog/domain/roster-entry.js';
import { parseSave } from '../domain/save-file.js';
import { cleanName, type Trainer } from '../domain/trainer.js';
import { TrainerRepository } from '../domain/trainer.repository.js';

export interface ProfileChanges {
  name?: string;
  avatar?: string;
  team?: string[];
  nickname?: { id: string; name: string } | null;
}

@Injectable()
export class TrainersService implements OnModuleInit {
  private readonly logger = new Logger(TrainersService.name);

  constructor(
    private readonly trainers: TrainerRepository,
    private readonly accounts: AccountsService,
  ) {}

  onModuleInit(): void {
    let fixed = 0;
    let relooked = 0;
    let refunded = 0;
    let moved = 0;
    let recycledUp = 0;
    let reverted = 0;
    const retiredPrices = {
      ...Object.fromEntries(Object.entries({ ...RETIRED_SHOP_TRAINERS, ...RETIRED_RECOLORS }).map(([key, rarity]) => [`trainer:${key}`, RARITIES[rarity].price])),
      ...Object.fromEntries(Object.entries(RETIRED_BALLS).map(([key, rarity]) => [`ball:${key}`, RARITIES[rarity].price])),
    };
    for (const trainer of this.trainers.all()) {
      const renamed = trainer.renameTrainers(RENAMED_TRAINERS);
      const devolved = trainer.revertRegionalEvolutions();
      const dropped = trainer.dropRepeatedSpecies();
      const released = trainer.releaseShopLook();
      const refund = trainer.refundRetired(retiredPrices);
      const toppedUp = trainer.topUpRecycled();
      if (renamed || devolved || dropped || released || refund || toppedUp) this.trainers.save(trainer);
      if (devolved) reverted += 1;
      if (toppedUp) recycledUp += 1;
      if (renamed) moved += 1;
      if (dropped) fixed += 1;
      if (released) relooked += 1;
      if (refund) refunded += 1;
    }
    if (reverted) this.logger.log(`Devolví a su forma a los Pokémon que habían evolucionado a una forma regional en ${reverted} entrenador(es).`);
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

  importSave(current: Trainer | undefined, input: { save: string; name?: string; password?: string }): { token: string | null; trainer: Trainer } {
    const parsed = parseSave(input.save);
    const name = cleanName(input.name ?? '');
    let trainer = current;
    let token: string | null = null;
    if (!trainer) {
      if (!name) throw invalid('Ponte un nombre de entrenador.');
      ({ token, trainer } = this.accounts.register(name, input.password ?? ''));
    } else if (name) this.rename(trainer, name);
    trainer.importSave(parsed, now());
    this.trainers.save(trainer);
    return { token, trainer };
  }

  syncSave(authorization: string | undefined, save: string): Trainer | undefined {
    const credentials = basicCredentials(authorization);
    const trainer = credentials && this.accounts.verify(credentials);
    if (!trainer) return undefined;
    return this.importSave(trainer, { save }).trainer;
  }

  private rename(trainer: Trainer, name: string): void {
    if (cleanName(name)) this.accounts.ensureNameFree(name, trainer);
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
